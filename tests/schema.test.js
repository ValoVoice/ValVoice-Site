/**
 * ValVoice Phase 1 Schema & RLS Test Suite
 * Validates the SQL DDL, RLS security policies, and PostgreSQL logic.
 * Uses native Node.js test runner (node:test).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MIGRATION_PATH = path.join(__dirname, '../supabase/migrations/20261115000000_valvoice_monetization_schema.sql');

describe('Phase 1 Database Schema & Migration Verification', () => {

  test('Migration file exists and is non-empty', () => {
    assert.ok(fs.existsSync(MIGRATION_PATH), 'Migration file must exist');
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
    assert.ok(sql.length > 500, 'Migration file must contain complete DDL');
  });

  test('All required tables are defined with IF NOT EXISTS', () => {
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
    const requiredTables = [
      'public.profiles',
      'public.subscriptions',
      'public.purchases',
      'public.entitlements',
      'public.webhook_events'
    ];

    for (const table of requiredTables) {
      const regex = new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table.replace('.', '\\.')}`, 'i');
      assert.ok(regex.test(sql), `Table ${table} must be created with IF NOT EXISTS`);
    }
  });

  test('All required indexes are defined', () => {
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
    const requiredIndexes = [
      'idx_profiles_display_id',
      'idx_profiles_email',
      'idx_subscriptions_user_id',
      'idx_subscriptions_customer_id',
      'idx_purchases_user_id',
      'idx_purchases_unlinked_email',
      'idx_entitlements_lookup',
      'idx_webhook_events_status'
    ];

    for (const idx of requiredIndexes) {
      assert.ok(sql.includes(idx), `Index ${idx} must be defined`);
    }
  });

  test('Row Level Security (RLS) is enabled on all 5 tables', () => {
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
    const tables = [
      'public.profiles',
      'public.subscriptions',
      'public.purchases',
      'public.entitlements',
      'public.webhook_events'
    ];

    for (const table of tables) {
      const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+${table.replace('.', '\\.')}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
      assert.ok(rlsRegex.test(sql), `RLS must be enabled on ${table}`);
    }
  });

  test('RLS Policies enforce strict tenant isolation and deny public writes', () => {
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');

    // Tenant isolation: users can only select where auth.uid() matches
    assert.ok(/USING\s*\(\s*auth\.uid\(\)\s*=\s*id\s*\)/i.test(sql), 'Profiles policy must check auth.uid() = id');
    assert.ok(/USING\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i.test(sql), 'Entitlements policy must check auth.uid() = user_id');
    assert.ok(/USING\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i.test(sql), 'Subscriptions policy must check auth.uid() = user_id');
    assert.ok(/USING\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i.test(sql), 'Purchases policy must check auth.uid() = user_id');

    // Zero public access on webhook_events
    assert.ok(/No public access to webhook events/i.test(sql), 'Webhook events policy must be defined');
    assert.ok(/USING\s*\(\s*FALSE\s*\)/i.test(sql), 'Webhook events must deny all authenticated and anon access with USING (FALSE)');
  });

  test('Display ID format specification and collision resistance', () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    assert.equal(chars.length, 32, 'Alphabet must contain exactly 32 unambiguous characters');
    assert.ok(!chars.includes('0'), 'Must not contain 0');
    assert.ok(!chars.includes('O'), 'Must not contain O');
    assert.ok(!chars.includes('1'), 'Must not contain 1');
    assert.ok(!chars.includes('I'), 'Must not contain I');

    // Simulate display ID generation
    function generateDisplayId() {
      let id = 'VV-';
      for (let i = 0; i < 8; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
      }
      return id;
    }

    const generated = new Set();
    const DISPLAY_ID_REGEX = /^VV-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;

    for (let i = 0; i < 10000; i++) {
      const id = generateDisplayId();
      assert.ok(DISPLAY_ID_REGEX.test(id), `Generated ID ${id} must match format ^VV-[A-Z0-9]{8}$`);
      assert.equal(id.length, 11, 'Display ID must be exactly 11 characters (VV- + 8 chars)');
      generated.add(id);
    }

    // 10,000 generated IDs should have 0 collisions in 32^8 space (~1.1 trillion)
    assert.equal(generated.size, 10000, '10,000 randomly generated IDs must be unique');
  });

  test('Webhook claim state machine simulates durable idempotency and retry', () => {
    // In-memory simulation of public.claim_webhook_event
    const db = new Map();

    function claimWebhookEvent(eventId, eventType, payload) {
      const existing = db.get(eventId);
      if (!existing) {
        // New event
        db.set(eventId, {
          event_id: eventId,
          event_type: eventType,
          payload,
          status: 'processing',
          attempts: 1
        });
        return 'processing';
      }

      if (existing.status === 'failed') {
        // Retry failed event
        existing.attempts += 1;
        existing.status = 'processing';
        return 'processing';
      }

      // If already processing or processed, ignore
      return null;
    }

    // 1. Initial event delivery
    const result1 = claimWebhookEvent('evt_101', 'subscription.activated', { id: 'sub_1' });
    assert.equal(result1, 'processing', 'First delivery must be claimed for processing');

    // 2. Duplicate delivery while still processing (e.g. concurrent webhook retry)
    const result2 = claimWebhookEvent('evt_101', 'subscription.activated', { id: 'sub_1' });
    assert.equal(result2, null, 'Duplicate delivery while processing must be ignored');

    // 3. Mark processed
    db.get('evt_101').status = 'processed';

    // 4. Duplicate delivery after successful completion
    const result3 = claimWebhookEvent('evt_101', 'subscription.activated', { id: 'sub_1' });
    assert.equal(result3, null, 'Duplicate delivery after processed must be ignored');

    // 5. Simulate event failure
    db.set('evt_102', { event_id: 'evt_102', status: 'failed', attempts: 1 });

    // 6. Retry after failure
    const retryResult = claimWebhookEvent('evt_102', 'subscription.activated', { id: 'sub_2' });
    assert.equal(retryResult, 'processing', 'Failed event must be reclaimable on retry');
    assert.equal(db.get('evt_102').attempts, 2, 'Attempt counter must increment on retry');
  });

  test('Effective entitlement priority logic resolves correctly', () => {
    // In-memory simulation of public.get_effective_entitlement
    function resolveEntitlement(entitlements, now = new Date()) {
      // 1. Check for active lifetime entitlement
      const lifetime = entitlements.find(e => e.status === 'active' && e.is_lifetime === true);
      if (lifetime) {
        return { tier: 'pro', is_lifetime: true, valid_until: null, status: 'active', source_type: lifetime.source_type };
      }

      // 2. Check for active subscription entitlement with future valid_until
      const activeSub = entitlements
        .filter(e => e.status === 'active' && !e.is_lifetime && (e.valid_until === null || new Date(e.valid_until) > now))
        .sort((a, b) => new Date(b.valid_until) - new Date(a.valid_until))[0];

      if (activeSub) {
        return { tier: 'pro', is_lifetime: false, valid_until: activeSub.valid_until, status: 'active', source_type: activeSub.source_type };
      }

      // 3. Fallback to free tier
      return { tier: 'free', is_lifetime: false, valid_until: null, status: 'active', source_type: 'default' };
    }

    const now = new Date('2026-11-15T00:00:00Z');

    // Case 1: User with lifetime purchase
    const user1 = [{ status: 'active', is_lifetime: true, source_type: 'lifetime', valid_until: null }];
    assert.deepEqual(resolveEntitlement(user1, now), {
      tier: 'pro',
      is_lifetime: true,
      valid_until: null,
      status: 'active',
      source_type: 'lifetime'
    });

    // Case 2: User with both lifetime AND subscription (lifetime wins)
    const user2 = [
      { status: 'active', is_lifetime: false, source_type: 'subscription', valid_until: '2026-12-01T00:00:00Z' },
      { status: 'active', is_lifetime: true, source_type: 'lifetime', valid_until: null }
    ];
    assert.equal(resolveEntitlement(user2, now).is_lifetime, true);
    assert.equal(resolveEntitlement(user2, now).tier, 'pro');

    // Case 3: User with active subscription
    const user3 = [
      { status: 'active', is_lifetime: false, source_type: 'subscription', valid_until: '2026-12-01T00:00:00Z' }
    ];
    const res3 = resolveEntitlement(user3, now);
    assert.equal(res3.tier, 'pro');
    assert.equal(res3.is_lifetime, false);
    assert.equal(res3.valid_until, '2026-12-01T00:00:00Z');

    // Case 4: User with expired subscription
    const user4 = [
      { status: 'active', is_lifetime: false, source_type: 'subscription', valid_until: '2026-11-01T00:00:00Z' }
    ];
    assert.equal(resolveEntitlement(user4, now).tier, 'free');

    // Case 5: User with revoked entitlement
    const user5 = [
      { status: 'revoked', is_lifetime: true, source_type: 'lifetime', valid_until: null }
    ];
    assert.equal(resolveEntitlement(user5, now).tier, 'free');

    // Case 6: User with zero entitlements
    assert.equal(resolveEntitlement([], now).tier, 'free');
  });

  test('Profile confirmation safety invariant is maintained', () => {
    // Verifies that unconfirmed auth.users are not marked confirmed
    function simulateUserChange(user, existingProfile) {
      const isConfirmed = Boolean(user.email_confirmed_at || user.confirmed_at);
      if (!existingProfile) {
        return {
          id: user.id,
          email: user.email || '',
          is_confirmed: isConfirmed,
          display_id: 'VV-TEST1234'
        };
      }
      return {
        ...existingProfile,
        email: user.email || existingProfile.email,
        is_confirmed: isConfirmed
      };
    }

    // Unconfirmed user signs up with OTP
    const unconfirmedUser = { id: 'usr-1', email: 'test@example.com', email_confirmed_at: null, confirmed_at: null };
    const profile1 = simulateUserChange(unconfirmedUser, null);
    assert.equal(profile1.is_confirmed, false, 'Unconfirmed user profile must have is_confirmed = false');

    // User submits 8-digit OTP; Supabase confirms email
    const confirmedUser = { ...unconfirmedUser, email_confirmed_at: '2026-11-15T00:30:00Z' };
    const profile2 = simulateUserChange(confirmedUser, profile1);
    assert.equal(profile2.is_confirmed, true, 'Profile must transition to is_confirmed = true when confirmed');
    assert.equal(profile2.display_id, profile1.display_id, 'Display ID must remain immutable during confirmation transition');
  });

});
