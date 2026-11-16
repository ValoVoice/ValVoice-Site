-- ==============================================================================
-- ValVoice Monetization, Licensing & Identity Schema Migration
-- Target: Supabase PostgreSQL (Postgres 15+)
-- Version: 1.0.0
-- Security: Strict Row Level Security (RLS) & Multi-State Idempotency
-- ==============================================================================

-- Ensure pgcrypto extension is available for UUID and random generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. Helper Functions
-- ==============================================================================

-- Generates a unique, cryptographically random display ID in the format 'VV-XXXXXXXX'
-- 8 random uppercase alphanumeric characters (excluding ambiguous characters: 0, O, I, 1)
CREATE OR REPLACE FUNCTION public.generate_unique_display_id()
RETURNS VARCHAR(11) AS $$
DECLARE
    -- 32-character unambiguous alphabet (excludes 0, O, 1, I to prevent visual confusion)
    chars CONSTANT TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    candidate VARCHAR(11);
    i INTEGER;
    done BOOLEAN := FALSE;
    attempts INTEGER := 0;
BEGIN
    WHILE NOT done AND attempts < 100 LOOP
        candidate := 'VV-';
        FOR i IN 1..8 LOOP
            candidate := candidate || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
        END LOOP;
        
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE display_id = candidate) THEN
            done := TRUE;
        END IF;
        attempts := attempts + 1;
    END LOOP;

    IF NOT done THEN
        RAISE EXCEPTION 'Failed to generate unique display ID after 100 attempts';
    END IF;

    RETURN candidate;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Trigger function to automatically maintain updated_at timestamps
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 2. Profiles Table (Extends Supabase auth.users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_id VARCHAR(16) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_profiles_display_id ON public.profiles(display_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Trigger for updated_at on profiles
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Safe, idempotent profile initialization function
CREATE OR REPLACE FUNCTION public.ensure_profile(p_user_id UUID)
RETURNS public.profiles AS $$
DECLARE
    v_user RECORD;
    v_profile public.profiles;
    v_is_confirmed BOOLEAN;
BEGIN
    -- Check if profile already exists
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
    IF FOUND THEN
        -- If user is now confirmed in auth.users but profile is not marked, sync confirmation
        SELECT (email_confirmed_at IS NOT NULL OR confirmed_at IS NOT NULL) INTO v_is_confirmed
        FROM auth.users WHERE id = p_user_id;

        IF v_is_confirmed AND NOT v_profile.is_confirmed THEN
            UPDATE public.profiles
            SET is_confirmed = TRUE, updated_at = TIMEZONE('utc'::text, NOW())
            WHERE id = p_user_id
            RETURNING * INTO v_profile;
        END IF;

        RETURN v_profile;
    END IF;

    -- Fetch user details from auth.users
    SELECT id, email, (email_confirmed_at IS NOT NULL OR confirmed_at IS NOT NULL) AS is_confirmed
    INTO v_user
    FROM auth.users
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User % not found in auth.users', p_user_id;
    END IF;

    -- Insert new profile with unique random display_id
    INSERT INTO public.profiles (id, display_id, email, is_confirmed)
    VALUES (
        v_user.id,
        public.generate_unique_display_id(),
        COALESCE(v_user.email, ''),
        COALESCE(v_user.is_confirmed, FALSE)
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        is_confirmed = EXCLUDED.is_confirmed,
        updated_at = TIMEZONE('utc'::text, NOW())
    RETURNING * INTO v_profile;

    RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safe trigger on auth.users for new user insertions and confirmation updates
CREATE OR REPLACE FUNCTION public.handle_auth_user_change()
RETURNS TRIGGER AS $$
DECLARE
    v_is_confirmed BOOLEAN;
BEGIN
    v_is_confirmed := (NEW.email_confirmed_at IS NOT NULL OR NEW.confirmed_at IS NOT NULL);

    -- Insert or update profile safely and idempotently
    INSERT INTO public.profiles (id, display_id, email, is_confirmed)
    VALUES (
        NEW.id,
        public.generate_unique_display_id(),
        COALESCE(NEW.email, ''),
        v_is_confirmed
    )
    ON CONFLICT (id) DO UPDATE
    SET email = COALESCE(NEW.email, public.profiles.email),
        is_confirmed = (NEW.email_confirmed_at IS NOT NULL OR NEW.confirmed_at IS NOT NULL),
        updated_at = TIMEZONE('utc'::text, NOW());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_or_updated ON auth.users;
CREATE TRIGGER on_auth_user_created_or_updated
    AFTER INSERT OR UPDATE OF email_confirmed_at, confirmed_at, email ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_change();

-- ==============================================================================
-- 3. Subscriptions Table (Paddle Recurring Subscriptions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id VARCHAR(64) PRIMARY KEY, -- Paddle subscription ID (sub_...)
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_id VARCHAR(64) NOT NULL, -- Paddle customer ID (ctm_...)
    status VARCHAR(32) NOT NULL, -- 'active', 'trialing', 'past_due', 'paused', 'canceled'
    plan_tier VARCHAR(32) NOT NULL DEFAULT 'pro',
    billing_cycle VARCHAR(16) NOT NULL, -- 'monthly', 'annual'
    price_id VARCHAR(64) NOT NULL,
    product_id VARCHAR(64) NOT NULL,
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    canceled_at TIMESTAMPTZ,
    last_event_occurred_at TIMESTAMPTZ, -- Event ordering check using Paddle occurred_at
    management_urls JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON public.subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 4. Purchases Table (One-time, Invoices, Lifetime Licenses)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.purchases (
    id VARCHAR(64) PRIMARY KEY, -- Paddle transaction ID (txn_...)
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_id VARCHAR(64) NOT NULL,
    customer_email VARCHAR(255), -- Preserved for unlinked purchase claims
    subscription_id VARCHAR(64) REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    amount_cents INTEGER NOT NULL, -- Smallest currency unit (e.g. 3000 for $30.00)
    currency VARCHAR(3) NOT NULL, -- 'USD', etc.
    status VARCHAR(32) NOT NULL, -- 'completed', 'refunded', 'disputed'
    product_id VARCHAR(64) NOT NULL,
    price_id VARCHAR(64) NOT NULL,
    is_lifetime BOOLEAN NOT NULL DEFAULT FALSE,
    invoice_number VARCHAR(64),
    receipt_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON public.purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_unlinked_email ON public.purchases(customer_email) WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_subscription_id ON public.purchases(subscription_id);

DROP TRIGGER IF EXISTS trg_purchases_updated_at ON public.purchases;
CREATE TRIGGER trg_purchases_updated_at
    BEFORE UPDATE ON public.purchases
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 5. Entitlements Table (Authoritative Access Rights)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tier VARCHAR(32) NOT NULL DEFAULT 'pro',
    source_type VARCHAR(32) NOT NULL, -- 'subscription', 'lifetime', 'manual_grant'
    source_id VARCHAR(64), -- references subscriptions.id or purchases.id
    status VARCHAR(32) NOT NULL DEFAULT 'active', -- 'active', 'expired', 'revoked'
    is_lifetime BOOLEAN NOT NULL DEFAULT FALSE,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ, -- NULL for lifetime licenses
    last_verified_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_entitlements_lookup ON public.entitlements(user_id, status);
CREATE INDEX IF NOT EXISTS idx_entitlements_source ON public.entitlements(source_type, source_id);

DROP TRIGGER IF EXISTS trg_entitlements_updated_at ON public.entitlements;
CREATE TRIGGER trg_entitlements_updated_at
    BEFORE UPDATE ON public.entitlements
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Resolves the effective plan tier and expiration for a given user
CREATE OR REPLACE FUNCTION public.get_effective_entitlement(p_user_id UUID)
RETURNS TABLE (
    tier VARCHAR(32),
    is_lifetime BOOLEAN,
    valid_until TIMESTAMPTZ,
    status VARCHAR(32),
    source_type VARCHAR(32),
    source_id VARCHAR(64)
) AS $$
BEGIN
    -- 1. Check for active lifetime entitlement first (highest priority)
    RETURN QUERY
    SELECT e.tier, e.is_lifetime, e.valid_until, e.status, e.source_type, e.source_id
    FROM public.entitlements e
    WHERE e.user_id = p_user_id
      AND e.status = 'active'
      AND e.is_lifetime = TRUE
    LIMIT 1;

    IF FOUND THEN
        RETURN;
    END IF;

    -- 2. Check for active subscription entitlement (with current validity)
    RETURN QUERY
    SELECT e.tier, e.is_lifetime, e.valid_until, e.status, e.source_type, e.source_id
    FROM public.entitlements e
    WHERE e.user_id = p_user_id
      AND e.status = 'active'
      AND e.is_lifetime = FALSE
      AND (e.valid_until IS NULL OR e.valid_until > TIMEZONE('utc'::text, NOW()))
    ORDER BY e.valid_until DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN;
    END IF;

    -- 3. Default to Free tier if no active Pro entitlements found
    RETURN QUERY
    SELECT 
        'free'::VARCHAR(32) AS tier,
        FALSE AS is_lifetime,
        NULL::TIMESTAMPTZ AS valid_until,
        'active'::VARCHAR(32) AS status,
        'default'::VARCHAR(32) AS source_type,
        NULL::VARCHAR(64) AS source_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ==============================================================================
-- 6. Webhook Events Table (Multi-State Idempotency & Audit Trail)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.webhook_events (
    event_id VARCHAR(64) PRIMARY KEY, -- Paddle event ID (evt_...)
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'processing', -- 'processing', 'processed', 'failed', 'ignored'
    error_message TEXT,
    attempts INTEGER NOT NULL DEFAULT 1,
    occurred_at TIMESTAMPTZ, -- Paddle event occurred_at timestamp
    received_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    processed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON public.webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_occurred_at ON public.webhook_events(occurred_at);

DROP TRIGGER IF EXISTS trg_webhook_events_updated_at ON public.webhook_events;
CREATE TRIGGER trg_webhook_events_updated_at
    BEFORE UPDATE ON public.webhook_events
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Durable atomic claim for webhook event processing
CREATE OR REPLACE FUNCTION public.claim_webhook_event(
    p_event_id VARCHAR(64),
    p_event_type VARCHAR(64),
    p_payload JSONB,
    p_occurred_at TIMESTAMPTZ
)
RETURNS VARCHAR(32) AS $$
DECLARE
    v_status VARCHAR(32);
BEGIN
    INSERT INTO public.webhook_events (
        event_id, event_type, payload, status, attempts, occurred_at, received_at
    )
    VALUES (
        p_event_id, p_event_type, p_payload, 'processing', 1, p_occurred_at, TIMEZONE('utc'::text, NOW())
    )
    ON CONFLICT (event_id) DO UPDATE
    SET attempts = webhook_events.attempts + 1,
        status = 'processing',
        error_message = NULL,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE webhook_events.status = 'failed'
    RETURNING status INTO v_status;

    -- Returns 'processing' if new or resumed from failed; returns NULL if already processed or in-progress
    RETURN v_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 7. Row Level Security (RLS) Policies
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- 7.1 Profiles Policies
-- Authenticated users can view their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Deny all public inserts/updates/deletes on profiles (service_role or trigger only)
DROP POLICY IF EXISTS "Profiles no client insert" ON public.profiles;
DROP POLICY IF EXISTS "Profiles no client update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles no client delete" ON public.profiles;

-- 7.2 Subscriptions Policies
-- Authenticated users can view their own subscriptions
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view their own subscriptions"
    ON public.subscriptions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 7.3 Purchases Policies
-- Authenticated users can view their own purchases
DROP POLICY IF EXISTS "Users can view their own purchases" ON public.purchases;
CREATE POLICY "Users can view their own purchases"
    ON public.purchases
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 7.4 Entitlements Policies
-- Authenticated users can view their own entitlements
DROP POLICY IF EXISTS "Users can view their own entitlements" ON public.entitlements;
CREATE POLICY "Users can view their own entitlements"
    ON public.entitlements
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 7.5 Webhook Events Policies
-- Zero public access: webhook_events is strictly private to service_role
DROP POLICY IF EXISTS "No public access to webhook events" ON public.webhook_events;
CREATE POLICY "No public access to webhook events"
    ON public.webhook_events
    FOR ALL
    TO authenticated, anon
    USING (FALSE);

-- ==============================================================================
-- End of Migration
-- ==============================================================================
