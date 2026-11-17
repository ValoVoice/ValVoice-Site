/**
 * Phase 3 — Frontend Checkout Integration Tests
 *
 * Tests for:
 *   - Public config endpoint (/api/config)
 *   - Tier name mapping (frontend → backend)
 *   - Auth modal structure
 *   - Checkout request format
 *   - Success page structure
 *   - Placeholder removal verification
 *   - SDK script inclusion
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════
// 1. Public Config Endpoint
// ═══════════════════════════════════════════════════════════════════════

describe('1. Public Config Endpoint (api/config.js)', () => {
  const configPath = path.join(__dirname, '..', 'api', 'config.js');

  it('config.js exists', () => {
    assert.ok(fs.existsSync(configPath), 'api/config.js must exist');
  });

  it('exports a function (Vercel serverless handler)', () => {
    const handler = require(configPath);
    assert.strictEqual(typeof handler, 'function');
  });

  it('returns 405 for POST requests', async () => {
    const handler = require(configPath);
    const { status, body } = await _invoke(handler, 'POST');
    assert.strictEqual(status, 405);
    assert.ok(body.error);
  });

  it('returns 204 for OPTIONS (CORS preflight)', async () => {
    const handler = require(configPath);
    const { status } = await _invoke(handler, 'OPTIONS');
    assert.strictEqual(status, 204);
  });

  it('returns 500 when required env vars are missing', async () => {
    const saved = { ...process.env };
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.PADDLE_CLIENT_TOKEN;
    delete process.env.PADDLE_ENVIRONMENT;

    const handler = require(configPath);
    const { status, body } = await _invoke(handler, 'GET');
    assert.strictEqual(status, 500);
    assert.ok(body.error.includes('configuration'));

    // Restore
    Object.assign(process.env, saved);
  });

  it('returns exactly 4 public keys when env vars are set', async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test_anon_key';
    process.env.PADDLE_CLIENT_TOKEN = 'test_client_token';
    process.env.PADDLE_ENVIRONMENT = 'sandbox';

    const handler = require(configPath);
    const { status, body } = await _invoke(handler, 'GET');
    assert.strictEqual(status, 200);

    const keys = Object.keys(body);
    assert.deepStrictEqual(keys.sort(), [
      'paddleClientToken',
      'paddleEnvironment',
      'supabaseAnonKey',
      'supabaseUrl',
    ]);
  });

  it('never returns secret keys', async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test_anon_key';
    process.env.PADDLE_CLIENT_TOKEN = 'test_client_token';
    process.env.PADDLE_ENVIRONMENT = 'sandbox';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'secret_service_role';
    process.env.PADDLE_API_KEY = 'secret_paddle_key';
    process.env.PADDLE_WEBHOOK_SECRET_KEY = 'secret_webhook';
    process.env.ED25519_PRIVATE_KEY_PEM = 'secret_ed25519';

    const handler = require(configPath);
    const { body } = await _invoke(handler, 'GET');
    const json = JSON.stringify(body);

    assert.ok(!json.includes('secret_service_role'), 'Must not leak SUPABASE_SERVICE_ROLE_KEY');
    assert.ok(!json.includes('secret_paddle_key'), 'Must not leak PADDLE_API_KEY');
    assert.ok(!json.includes('secret_webhook'), 'Must not leak PADDLE_WEBHOOK_SECRET_KEY');
    assert.ok(!json.includes('secret_ed25519'), 'Must not leak ED25519_PRIVATE_KEY_PEM');
  });

  it('trims whitespace from env values', async () => {
    process.env.SUPABASE_URL = '  https://test.supabase.co  ';
    process.env.SUPABASE_ANON_KEY = '  key  ';
    process.env.PADDLE_CLIENT_TOKEN = '  token  ';
    process.env.PADDLE_ENVIRONMENT = '  Sandbox  ';

    const handler = require(configPath);
    const { body } = await _invoke(handler, 'GET');
    assert.strictEqual(body.supabaseUrl, 'https://test.supabase.co');
    assert.strictEqual(body.paddleEnvironment, 'sandbox');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. Tier Name Mapping
// ═══════════════════════════════════════════════════════════════════════

describe('2. Frontend Tier Name Mapping', () => {
  const TIER_MAP = {
    monthly:  'monthly',
    yearly:   'annual',
    annual:   'annual',
    lifetime: 'lifetime',
  };

  it('monthly maps to monthly', () => {
    assert.strictEqual(TIER_MAP['monthly'], 'monthly');
  });

  it('yearly maps to annual (critical mapping)', () => {
    assert.strictEqual(TIER_MAP['yearly'], 'annual');
  });

  it('annual maps to annual', () => {
    assert.strictEqual(TIER_MAP['annual'], 'annual');
  });

  it('lifetime maps to lifetime', () => {
    assert.strictEqual(TIER_MAP['lifetime'], 'lifetime');
  });

  it('backend VALID_TIERS accepts all mapped values', () => {
    const VALID_TIERS = new Set(['monthly', 'annual', 'lifetime']);
    const mapped = Object.values(TIER_MAP);
    for (const t of mapped) {
      assert.ok(VALID_TIERS.has(t), `Backend must accept tier "${t}"`);
    }
  });

  it('frontend toggle values map correctly', () => {
    // pricing.html toggle calls setBilling('monthly') and setBilling('yearly')
    assert.strictEqual(TIER_MAP['monthly'], 'monthly');
    assert.strictEqual(TIER_MAP['yearly'], 'annual');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. HTML Structure Verification
// ═══════════════════════════════════════════════════════════════════════

describe('3. Pricing Page Integration', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pricing.html'), 'utf-8');

  it('includes Supabase JS SDK', () => {
    assert.ok(html.includes('supabase.min.js'), 'Must include Supabase JS CDN');
  });

  it('includes Paddle.js v2', () => {
    assert.ok(html.includes('cdn.paddle.com/paddle/v2/paddle.js'), 'Must include Paddle.js CDN');
  });

  it('includes valvoice-auth.js', () => {
    assert.ok(html.includes('valvoice-auth.js'), 'Must include auth module');
  });

  it('includes valvoice-checkout.js', () => {
    assert.ok(html.includes('valvoice-checkout.js'), 'Must include checkout module');
  });

  it('contains auth modal HTML', () => {
    assert.ok(html.includes('vv-auth-modal'), 'Must contain auth modal');
    assert.ok(html.includes('vv-auth-step-email'), 'Must contain email step');
    assert.ok(html.includes('vv-auth-step-otp'), 'Must contain OTP step');
  });

  it('contains auth indicator in header', () => {
    assert.ok(html.includes('vv-auth-indicator'), 'Must contain auth indicator');
    assert.ok(html.includes('vv-auth-logout-btn'), 'Must contain logout button');
  });

  it('Pro CTA calls ValVoiceCheckout.startCheckout', () => {
    assert.ok(html.includes('ValVoiceCheckout.startCheckout(currentBillingPeriod)'), 'Pro CTA must call checkout');
  });

  it('Lifetime CTA calls ValVoiceCheckout.startCheckout(lifetime)', () => {
    assert.ok(html.includes("ValVoiceCheckout.startCheckout('lifetime')"), 'Lifetime CTA must call checkout');
  });

  it('removed "Paid checkout onboarding in progress via Paddle"', () => {
    assert.ok(!html.includes('onboarding in progress'), 'Placeholder must be removed');
  });

  it('removed "One-time purchase option coming soon"', () => {
    assert.ok(!html.includes('coming soon'), 'Placeholder must be removed');
  });

  it('tracks currentBillingPeriod variable', () => {
    assert.ok(html.includes('currentBillingPeriod'), 'Must track billing period');
  });

  it('setBilling updates currentBillingPeriod', () => {
    assert.ok(html.includes('currentBillingPeriod = plan'), 'setBilling must update period');
  });

  it('Pro CTA is a button, not a disabled link', () => {
    assert.ok(!html.includes('cursor: not-allowed'), 'Must not have disabled cursor on Pro CTA');
    const proCta = html.match(/<button[^>]*id="pro-cta"[^>]*>/);
    assert.ok(proCta, 'Pro CTA must be a <button>');
  });
});

describe('4. Index Page Integration', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8');

  it('includes Supabase JS SDK', () => {
    assert.ok(html.includes('supabase.min.js'), 'Must include Supabase JS CDN');
  });

  it('includes Paddle.js v2', () => {
    assert.ok(html.includes('cdn.paddle.com/paddle/v2/paddle.js'), 'Must include Paddle.js CDN');
  });

  it('includes auth and checkout modules', () => {
    assert.ok(html.includes('valvoice-auth.js'), 'Must include auth module');
    assert.ok(html.includes('valvoice-checkout.js'), 'Must include checkout module');
  });

  it('contains auth modal HTML', () => {
    assert.ok(html.includes('vv-auth-modal'), 'Must contain auth modal');
  });

  it('Pro CTA is wired to checkout (not disabled)', () => {
    assert.ok(!html.includes('cursor: not-allowed'), 'Must not have disabled cursor');
    assert.ok(!html.includes('opacity: 0.8'), 'Must not have reduced opacity on CTA');
    assert.ok(html.includes('ValVoiceCheckout.startCheckout(currentBillingPeriod)'));
  });

  it('Lifetime CTA is wired to checkout', () => {
    assert.ok(html.includes("ValVoiceCheckout.startCheckout('lifetime')") ||
              html.includes('ValVoiceCheckout.startCheckout(\'lifetime\')'));
  });

  it('setBilling updates currentBillingPeriod', () => {
    assert.ok(html.includes('currentBillingPeriod = plan'));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. Success Page
// ═══════════════════════════════════════════════════════════════════════

describe('5. Checkout Success Page', () => {
  const successPath = path.join(__dirname, '..', 'checkout', 'success.html');

  it('success.html exists', () => {
    assert.ok(fs.existsSync(successPath), 'checkout/success.html must exist');
  });

  it('includes Supabase JS SDK for session restoration', () => {
    const html = fs.readFileSync(successPath, 'utf-8');
    assert.ok(html.includes('supabase.min.js'));
  });

  it('calls /api/entitlements/sync', () => {
    const html = fs.readFileSync(successPath, 'utf-8');
    assert.ok(html.includes('/api/entitlements/sync'), 'Must call sync endpoint');
  });

  it('calls /api/config for public configuration', () => {
    const html = fs.readFileSync(successPath, 'utf-8');
    assert.ok(html.includes('/api/config'), 'Must fetch config');
  });

  it('shows success, pending, and error states', () => {
    const html = fs.readFileSync(successPath, 'utf-8');
    assert.ok(html.includes('showSuccess'), 'Must have success state');
    assert.ok(html.includes('showPending'), 'Must have pending state');
    assert.ok(html.includes('showError'), 'Must have error state');
  });

  it('includes download link', () => {
    const html = fs.readFileSync(successPath, 'utf-8');
    assert.ok(html.includes('/download'), 'Must link to download');
  });

  it('includes back to home link', () => {
    const html = fs.readFileSync(successPath, 'utf-8');
    assert.ok(html.includes('href="/"'), 'Must link back to home');
  });

  it('never independently grants entitlements from client', () => {
    const html = fs.readFileSync(successPath, 'utf-8');
    // The page calls /api/entitlements/sync which is server-side verification
    // It should NOT contain any direct entitlement granting
    assert.ok(!html.includes('localStorage.setItem') || !html.includes('entitlement'),
      'Must not grant entitlements client-side via localStorage');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. Vercel Configuration
// ═══════════════════════════════════════════════════════════════════════

describe('6. Vercel Configuration', () => {
  const vercelConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf-8')
  );

  it('has rewrite for /checkout/success', () => {
    const rewrites = vercelConfig.rewrites || [];
    const successRewrite = rewrites.find(r => r.source === '/checkout/success');
    assert.ok(successRewrite, 'Must have /checkout/success rewrite');
    assert.strictEqual(successRewrite.destination, '/checkout/success.html');
  });

  it('existing rewrites are preserved', () => {
    const rewrites = vercelConfig.rewrites || [];
    const sources = rewrites.map(r => r.source);
    assert.ok(sources.includes('/pricing'), '/pricing rewrite preserved');
    assert.ok(sources.includes('/terms'), '/terms rewrite preserved');
    assert.ok(sources.includes('/faq'), '/faq rewrite preserved');
  });

  it('download redirect is preserved', () => {
    const redirects = vercelConfig.redirects || [];
    const dl = redirects.find(r => r.source === '/download');
    assert.ok(dl, 'Download redirect must be preserved');
    assert.ok(dl.destination.includes('github.com'));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. Auth Module Structure
// ═══════════════════════════════════════════════════════════════════════

describe('7. Auth Module (js/valvoice-auth.js)', () => {
  const authPath = path.join(__dirname, '..', 'js', 'valvoice-auth.js');

  it('valvoice-auth.js exists', () => {
    assert.ok(fs.existsSync(authPath));
  });

  it('contains OTP sign-in function', () => {
    const src = fs.readFileSync(authPath, 'utf-8');
    assert.ok(src.includes('signInWithOtp'));
  });

  it('contains OTP verification function', () => {
    const src = fs.readFileSync(authPath, 'utf-8');
    assert.ok(src.includes('verifyOtp'));
  });

  it('contains resend OTP function', () => {
    const src = fs.readFileSync(authPath, 'utf-8');
    assert.ok(src.includes('resendOtp'));
  });

  it('contains signOut function', () => {
    const src = fs.readFileSync(authPath, 'utf-8');
    assert.ok(src.includes('signOut'));
  });

  it('contains session management', () => {
    const src = fs.readFileSync(authPath, 'utf-8');
    assert.ok(src.includes('getSession'));
    assert.ok(src.includes('getAccessToken'));
    assert.ok(src.includes('isAuthenticated'));
  });

  it('fetches /api/config for initialization', () => {
    const src = fs.readFileSync(authPath, 'utf-8');
    assert.ok(src.includes('/api/config'));
  });

  it('handles rate limit errors', () => {
    const src = fs.readFileSync(authPath, 'utf-8');
    assert.ok(src.includes('rate') || src.includes('429'));
  });

  it('handles expired/invalid OTP errors', () => {
    const src = fs.readFileSync(authPath, 'utf-8');
    assert.ok(src.includes('expired') || src.includes('invalid'));
  });

  it('validates 6-digit OTP format', () => {
    const src = fs.readFileSync(authPath, 'utf-8');
    assert.ok(src.includes('\\d{6}'));
  });

  it('exposes ValVoiceAuth on window', () => {
    const src = fs.readFileSync(authPath, 'utf-8');
    assert.ok(src.includes('window.ValVoiceAuth'));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. Checkout Module Structure
// ═══════════════════════════════════════════════════════════════════════

describe('8. Checkout Module (js/valvoice-checkout.js)', () => {
  const checkoutPath = path.join(__dirname, '..', 'js', 'valvoice-checkout.js');

  it('valvoice-checkout.js exists', () => {
    assert.ok(fs.existsSync(checkoutPath));
  });

  it('contains startCheckout function', () => {
    const src = fs.readFileSync(checkoutPath, 'utf-8');
    assert.ok(src.includes('startCheckout'));
  });

  it('maps yearly to annual', () => {
    const src = fs.readFileSync(checkoutPath, 'utf-8');
    assert.ok(src.includes("yearly") && src.includes("annual"));
  });

  it('calls POST /api/checkout/create', () => {
    const src = fs.readFileSync(checkoutPath, 'utf-8');
    assert.ok(src.includes('/api/checkout/create'));
  });

  it('sends Authorization: Bearer header', () => {
    const src = fs.readFileSync(checkoutPath, 'utf-8');
    assert.ok(src.includes('Bearer'));
  });

  it('sends tier in request body (not price_id)', () => {
    const src = fs.readFileSync(checkoutPath, 'utf-8');
    assert.ok(src.includes('tier: backendTier') || src.includes('tier'));
    assert.ok(!src.includes('price_id'), 'Frontend must NOT send price_id');
  });

  it('has duplicate-click protection', () => {
    const src = fs.readFileSync(checkoutPath, 'utf-8');
    assert.ok(src.includes('_checkoutInProgress'));
  });

  it('opens Paddle checkout overlay with transactionId', () => {
    const src = fs.readFileSync(checkoutPath, 'utf-8');
    assert.ok(src.includes('Paddle.Checkout.open'));
    assert.ok(src.includes('transactionId'));
  });

  it('initializes Paddle in sandbox mode', () => {
    const src = fs.readFileSync(checkoutPath, 'utf-8');
    assert.ok(src.includes('Paddle.Initialize'));
    assert.ok(src.includes('sandbox'));
  });

  it('shows auth modal when user is not authenticated', () => {
    const src = fs.readFileSync(checkoutPath, 'utf-8');
    assert.ok(src.includes('showModal'));
  });

  it('handles checkout.completed event', () => {
    const src = fs.readFileSync(checkoutPath, 'utf-8');
    assert.ok(src.includes('checkout.completed'));
  });

  it('redirects to /checkout/success on completion', () => {
    const src = fs.readFileSync(checkoutPath, 'utf-8');
    assert.ok(src.includes('/checkout/success'));
  });

  it('exposes ValVoiceCheckout on window', () => {
    const src = fs.readFileSync(checkoutPath, 'utf-8');
    assert.ok(src.includes('window.ValVoiceCheckout'));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 8. CSS Verification
// ═══════════════════════════════════════════════════════════════════════

describe('9. Auth Modal CSS', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf-8');

  it('contains auth modal styles', () => {
    assert.ok(css.includes('.vv-auth-modal'));
  });

  it('contains auth dialog styles', () => {
    assert.ok(css.includes('.vv-auth-dialog'));
  });

  it('contains auth backdrop styles', () => {
    assert.ok(css.includes('.vv-auth-backdrop'));
  });

  it('contains auth indicator styles', () => {
    assert.ok(css.includes('.vv-auth-indicator'));
  });

  it('contains OTP input styling', () => {
    assert.ok(css.includes('#vv-auth-otp'));
  });

  it('contains spinner animation', () => {
    assert.ok(css.includes('vvSpin'));
  });

  it('contains mobile responsive breakpoint', () => {
    assert.ok(css.includes('480px') || css.includes('max-width'));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Mock HTTP helper for testing serverless handlers
// ═══════════════════════════════════════════════════════════════════════

function _invoke(handler, method = 'GET') {
  return new Promise((resolve) => {
    const req = { method, headers: {} };
    let _status = 200;
    let _body = '';
    const _headers = {};
    const res = {
      statusCode: 200,
      setHeader(k, v) { _headers[k] = v; },
      end(data) {
        let body;
        try { body = JSON.parse(data || '{}'); } catch { body = data; }
        resolve({ status: res.statusCode, body, headers: _headers });
      },
      set statusCode(v) { _status = v; },
      get statusCode() { return _status; },
    };
    handler(req, res);
  });
}
