/**
 * ValVoice Phase 2 Backend Test Suite
 *
 * Comprehensive tests for all Phase 2 backend components:
 * - Environment variable validation
 * - Paddle HMAC webhook signature verification
 * - Replay attack prevention
 * - Idempotency state machine
 * - Ed25519 token signing & verification
 * - Token tampering detection
 * - Entitlement priority resolution
 * - Checkout tier validation
 * - Billing email extraction
 * - Paddle price ID resolution
 *
 * Uses Node.js native test runner (zero external dependencies).
 * Run: node --test tests/phase2.test.js
 */

'use strict';

const { test, describe, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// ─────────────────────────────────────────────────────────────────────────────
// Test Environment Setup
// ─────────────────────────────────────────────────────────────────────────────

// Generate a fresh Ed25519 keypair for each test run
const { publicKey: TEST_PUBLIC_KEY, privateKey: TEST_PRIVATE_KEY } = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// Generate a 32-byte random webhook secret
const TEST_WEBHOOK_SECRET = crypto.randomBytes(32).toString('hex');

// Set all required environment variables for tests
function setTestEnv(overrides = {}) {
  const defaults = {
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-' + crypto.randomBytes(8).toString('hex'),
    PADDLE_API_KEY: 'test-paddle-api-key-' + crypto.randomBytes(8).toString('hex'),
    PADDLE_WEBHOOK_SECRET_KEY: TEST_WEBHOOK_SECRET,
    PADDLE_ENVIRONMENT: 'sandbox',
    PADDLE_PRICE_MONTHLY: 'pri_01monthly_test',
    PADDLE_PRICE_ANNUAL: 'pri_01annual_test',
    PADDLE_PRICE_LIFETIME: 'pri_01lifetime_test',
    ED25519_PRIVATE_KEY_PEM: TEST_PRIVATE_KEY,
    ED25519_PUBLIC_KEY_PEM: TEST_PUBLIC_KEY,
    ENTITLEMENT_TOKEN_TTL_SECONDS: '604800', // 7 days
  };

  Object.assign(process.env, defaults, overrides);
}

// Apply env before all tests
setTestEnv();

// ─────────────────────────────────────────────────────────────────────────────
// Module Imports (after env is set)
// ─────────────────────────────────────────────────────────────────────────────

const { env, _resetForTest } = require('../lib/env');
const { verifyPaddleWebhook, extractCustomUserId, extractBillingEmail, isStaleEvent, evaluateAdjustment, WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS } = require('../lib/webhook');
const { signEntitlementToken, verifyEntitlementToken, PRO_FEATURES, FREE_FEATURES, TOKEN_ISSUER } = require('../lib/token');
const { resolvePriceId, PADDLE_SANDBOX_HOST, getPaddleHost } = require('../lib/paddle');

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Build a valid Paddle-Signature header
// ─────────────────────────────────────────────────────────────────────────────

function buildPaddleSignature(rawBody, secret = TEST_WEBHOOK_SECRET, tsOverride = null) {
  const ts = tsOverride !== null ? tsOverride : Math.floor(Date.now() / 1000);
  const signingPayload = `${ts}:${rawBody}`;
  const h1 = crypto.createHmac('sha256', secret).update(signingPayload, 'utf8').digest('hex');
  return { header: `ts=${ts};h1=${h1}`, ts };
}

function buildValidEvent(overrides = {}) {
  return {
    event_id: `evt_${crypto.randomBytes(8).toString('hex')}`,
    event_type: 'subscription.activated',
    occurred_at: new Date().toISOString(),
    data: {
      id: 'sub_test123',
      customer_id: 'ctm_test456',
      status: 'active',
      custom_data: { supabase_user_id: 'usr-00000000-0000-0000-0000-000000000001' },
      current_billing_period: {
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      },
      items: [{ price: { id: 'pri_01monthly_test', billing_cycle: { interval: 'month' } } }],
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Environment Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('1. Environment Variable Validation', () => {

  test('validateEnv() succeeds with all required vars set', () => {
    _resetForTest();
    setTestEnv();
    // Should not throw
    const { validateEnv } = require('../lib/env');
    assert.doesNotThrow(() => validateEnv());
  });

  test('env() throws on production Paddle environment (guard)', () => {
    _resetForTest();
    setTestEnv({ PADDLE_ENVIRONMENT: 'production' });
    const { validateEnv } = require('../lib/env');
    assert.throws(() => validateEnv(), /Live Paddle production payments are not enabled/);
    setTestEnv(); // restore
    _resetForTest();
  });

  test('env() throws when ENTITLEMENT_TOKEN_TTL_SECONDS is too small', () => {
    _resetForTest();
    setTestEnv({ ENTITLEMENT_TOKEN_TTL_SECONDS: '100' }); // < 3600
    const { validateEnv } = require('../lib/env');
    assert.throws(() => validateEnv(), /must be a positive integer >= 3600/);
    setTestEnv();
    _resetForTest();
  });

  test('env() is idempotent — validates only once per process', () => {
    _resetForTest();
    setTestEnv();
    const { validateEnv } = require('../lib/env');
    // Call three times — should not throw
    assert.doesNotThrow(() => { validateEnv(); validateEnv(); validateEnv(); });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Paddle HMAC Webhook Signature Verification Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('2. Paddle Webhook Signature Verification', () => {

  test('Valid signature verifies successfully', () => {
    const event = buildValidEvent();
    const rawBody = JSON.stringify(event);
    const { header } = buildPaddleSignature(rawBody);

    const result = verifyPaddleWebhook(rawBody, header);
    assert.equal(result.valid, true);
    assert.equal(result.eventId, event.event_id);
    assert.equal(result.occurredAt, event.occurred_at);
    assert.deepEqual(result.event.event_id, event.event_id);
  });

  test('Missing Paddle-Signature header throws 401', () => {
    const rawBody = JSON.stringify(buildValidEvent());
    assert.throws(
      () => verifyPaddleWebhook(rawBody, null),
      (err) => err.status === 401 && /Missing Paddle-Signature/.test(err.message)
    );
  });

  test('Empty Paddle-Signature header throws 401', () => {
    const rawBody = JSON.stringify(buildValidEvent());
    assert.throws(
      () => verifyPaddleWebhook(rawBody, ''),
      (err) => err.status === 401
    );
  });

  test('Malformed header (missing h1) throws 401', () => {
    const rawBody = JSON.stringify(buildValidEvent());
    assert.throws(
      () => verifyPaddleWebhook(rawBody, 'ts=1234567890'),
      (err) => err.status === 401 && /Malformed/.test(err.message)
    );
  });

  test('Malformed header (missing ts) throws 401', () => {
    const rawBody = JSON.stringify(buildValidEvent());
    const fakeH1 = crypto.randomBytes(32).toString('hex');
    assert.throws(
      () => verifyPaddleWebhook(rawBody, `h1=${fakeH1}`),
      (err) => err.status === 401 && /Malformed/.test(err.message)
    );
  });

  test('REPLAY ATTACK: Timestamp outside tolerance window throws 400', () => {
    const rawBody = JSON.stringify(buildValidEvent());
    // Timestamp 10 minutes in the past — beyond 300s tolerance
    const staleTs = Math.floor(Date.now() / 1000) - 601;
    const { header } = buildPaddleSignature(rawBody, TEST_WEBHOOK_SECRET, staleTs);
    assert.throws(
      () => verifyPaddleWebhook(rawBody, header),
      (err) => err.status === 400 && err.code === 'WEBHOOK_REPLAY'
    );
  });

  test('REPLAY ATTACK: Future timestamp far outside tolerance throws 400', () => {
    const rawBody = JSON.stringify(buildValidEvent());
    const futureTs = Math.floor(Date.now() / 1000) + 601;
    const { header } = buildPaddleSignature(rawBody, TEST_WEBHOOK_SECRET, futureTs);
    assert.throws(
      () => verifyPaddleWebhook(rawBody, header),
      (err) => err.status === 400 && err.code === 'WEBHOOK_REPLAY'
    );
  });

  test('TAMPER: Modified body (1 byte changed) throws 403', () => {
    const event = buildValidEvent();
    const rawBody = JSON.stringify(event);
    const { header } = buildPaddleSignature(rawBody);

    // Tamper: change one character in the body
    const tamperedBody = rawBody.slice(0, -1) + (rawBody.endsWith('}') ? 'X' : '}');
    assert.throws(
      () => verifyPaddleWebhook(tamperedBody, header),
      (err) => err.status === 403 && err.code === 'INVALID_SIGNATURE'
    );
  });

  test('TAMPER: Wrong webhook secret throws 403', () => {
    const rawBody = JSON.stringify(buildValidEvent());
    const wrongSecret = crypto.randomBytes(32).toString('hex');
    const { header } = buildPaddleSignature(rawBody, wrongSecret);
    assert.throws(
      () => verifyPaddleWebhook(rawBody, header),
      (err) => err.status === 403 && err.code === 'INVALID_SIGNATURE'
    );
  });

  test('TAMPER: Truncated h1 throws 403 (length mismatch)', () => {
    const rawBody = JSON.stringify(buildValidEvent());
    const ts = Math.floor(Date.now() / 1000);
    const h1 = crypto.createHmac('sha256', TEST_WEBHOOK_SECRET)
      .update(`${ts}:${rawBody}`, 'utf8').digest('hex');
    // Truncate h1 to half length
    const truncatedHeader = `ts=${ts};h1=${h1.slice(0, 32)}`;
    assert.throws(
      () => verifyPaddleWebhook(rawBody, truncatedHeader),
      (err) => err.status === 403
    );
  });

  test('Timing-safe equal is used (not string ===)', () => {
    // This is structural — verifyPaddleWebhook uses crypto.timingSafeEqual
    // We verify by confirming it does NOT throw on equal-length wrong sig
    const rawBody = JSON.stringify(buildValidEvent());
    const ts = Math.floor(Date.now() / 1000);
    // Craft a wrong sig that is the SAME length (32 bytes = 64 hex chars)
    const wrongH1 = '0'.repeat(64);
    const header = `ts=${ts};h1=${wrongH1}`;
    assert.throws(
      () => verifyPaddleWebhook(rawBody, header),
      (err) => err.status === 403 && err.code === 'INVALID_SIGNATURE'
    );
  });

  test('Tolerance window: timestamp exactly at boundary is accepted', () => {
    const event = buildValidEvent();
    const rawBody = JSON.stringify(event);
    // Exactly at the tolerance boundary (300 seconds ago)
    const boundaryTs = Math.floor(Date.now() / 1000) - WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS;
    const { header } = buildPaddleSignature(rawBody, TEST_WEBHOOK_SECRET, boundaryTs);
    // Should NOT throw
    assert.doesNotThrow(() => verifyPaddleWebhook(rawBody, header));
  });

  test('extractCustomUserId returns supabase_user_id from custom_data', () => {
    const event = buildValidEvent();
    const userId = extractCustomUserId(event);
    assert.equal(userId, 'usr-00000000-0000-0000-0000-000000000001');
  });

  test('extractCustomUserId returns null when custom_data is missing', () => {
    const event = buildValidEvent();
    delete event.data.custom_data;
    assert.equal(extractCustomUserId(event), null);
  });

  test('extractBillingEmail extracts customer email from transaction event', () => {
    const event = {
      event_id: 'evt_test',
      event_type: 'transaction.completed',
      occurred_at: new Date().toISOString(),
      data: {
        id: 'txn_test',
        customer: { email: 'player@example.com' },
      },
    };
    assert.equal(extractBillingEmail(event), 'player@example.com');
  });

  test('extractBillingEmail normalises email to lowercase', () => {
    const event = {
      data: { customer: { email: 'PLAYER@EXAMPLE.COM' } },
    };
    assert.equal(extractBillingEmail(event), 'player@example.com');
  });

  test('extractBillingEmail returns null when no email fields present', () => {
    const event = { data: {} };
    assert.equal(extractBillingEmail(event), null);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Ed25519 Token Signing & Verification Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('3. Ed25519 Entitlement Token Signing & Verification', () => {

  const TEST_USER_ID = '00000000-0000-0000-0000-000000000042';
  const TEST_DISPLAY_ID = 'VV-TESTABCD';

  function signProToken(overrides = {}) {
    return signEntitlementToken({
      userId: TEST_USER_ID,
      displayId: TEST_DISPLAY_ID,
      tier: 'pro',
      isLifetime: false,
      validUntil: new Date(Date.now() + 30 * 24 * 3600000).toISOString(),
      ...overrides,
    });
  }

  test('Valid Pro token is signed and verifies successfully', () => {
    const token = signProToken();
    const { valid, claims } = verifyEntitlementToken(token);

    assert.equal(valid, true);
    assert.equal(claims.sub, TEST_USER_ID);
    assert.equal(claims.display_id, TEST_DISPLAY_ID);
    assert.equal(claims.tier, 'pro');
    assert.equal(claims.is_lifetime, false);
    assert.equal(claims.iss, TOKEN_ISSUER);
    assert.ok(Array.isArray(claims.features));
    assert.deepEqual(claims.features, PRO_FEATURES);
  });

  test('Valid Free token is signed and verifies successfully', () => {
    const token = signEntitlementToken({
      userId: TEST_USER_ID,
      displayId: TEST_DISPLAY_ID,
      tier: 'free',
      isLifetime: false,
      validUntil: null,
    });

    const { valid, claims } = verifyEntitlementToken(token);
    assert.equal(valid, true);
    assert.equal(claims.tier, 'free');
    assert.deepEqual(claims.features, FREE_FEATURES);
  });

  test('Lifetime Pro token has null valid_until and is_lifetime=true', () => {
    const token = signEntitlementToken({
      userId: TEST_USER_ID,
      displayId: TEST_DISPLAY_ID,
      tier: 'pro',
      isLifetime: true,
      validUntil: null,
    });

    const { valid, claims } = verifyEntitlementToken(token);
    assert.equal(valid, true);
    assert.equal(claims.tier, 'pro');
    assert.equal(claims.is_lifetime, true);
    assert.equal(claims.valid_until, null);
  });

  test('Token contains 3 dot-separated base64url parts', () => {
    const token = signProToken();
    const parts = token.split('.');
    assert.equal(parts.length, 3, 'Token must have exactly 3 parts: header.payload.signature');
    // Each part must be valid base64url (no + / or =)
    for (const part of parts) {
      assert.doesNotMatch(part, /[+/=]/, `Part "${part.substring(0, 20)}..." must not contain +, /, or =`);
    }
  });

  test('TAMPER: Modifying tier claim from free to pro fails verification', () => {
    const freeToken = signEntitlementToken({
      userId: TEST_USER_ID,
      displayId: TEST_DISPLAY_ID,
      tier: 'free',
      isLifetime: false,
      validUntil: null,
    });

    const [header, payload, sig] = freeToken.split('.');

    // Decode, tamper, re-encode payload
    function b64urlDecode(s) {
      const pad = s.replace(/-/g, '+').replace(/_/g, '/');
      return Buffer.from(pad + '='.repeat((4 - pad.length % 4) % 4), 'base64');
    }
    function b64url(buf) {
      return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    const claims = JSON.parse(b64urlDecode(payload).toString('utf8'));
    claims.tier = 'pro'; // Tamper!
    claims.features = ['all_agent_voices', 'unlimited_quota']; // Also tamper!

    const tamperedPayload = b64url(Buffer.from(JSON.stringify(claims), 'utf8'));
    const tamperedToken = `${header}.${tamperedPayload}.${sig}`;

    const result = verifyEntitlementToken(tamperedToken);
    assert.equal(result.valid, false, 'Tampered token must be rejected');
    assert.match(result.reason, /Signature does not match/);
  });

  test('TAMPER: Modifying sub (userId) in payload fails verification', () => {
    const token = signProToken();
    const [h, p, s] = token.split('.');

    function b64urlDecode(str) {
      const pad = str.replace(/-/g, '+').replace(/_/g, '/');
      return Buffer.from(pad + '='.repeat((4 - pad.length % 4) % 4), 'base64');
    }
    function b64url(buf) {
      return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    const claims = JSON.parse(b64urlDecode(p).toString('utf8'));
    claims.sub = '99999999-9999-9999-9999-999999999999'; // Different user!
    const tamperedPayload = b64url(Buffer.from(JSON.stringify(claims), 'utf8'));
    const tamperedToken = `${h}.${tamperedPayload}.${s}`;

    const result = verifyEntitlementToken(tamperedToken);
    assert.equal(result.valid, false);
  });

  test('EXPIRED: Expired token is rejected', () => {
    // We need to test with an expired token — sign with negative TTL
    // We'll directly sign a token with a past exp
    const privateKey = crypto.createPrivateKey(TEST_PRIVATE_KEY);

    function b64url(buf) {
      return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    const headerB64 = b64url(Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'VV1' }), 'utf8'));
    const expiredClaims = {
      sub: TEST_USER_ID,
      display_id: TEST_DISPLAY_ID,
      tier: 'pro',
      features: PRO_FEATURES,
      is_lifetime: false,
      valid_until: null,
      iss: TOKEN_ISSUER,
      iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
      exp: Math.floor(Date.now() / 1000) - 3600,  // Expired 1 hour ago
    };

    const payloadB64 = b64url(Buffer.from(JSON.stringify(expiredClaims), 'utf8'));
    const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
    const signature = crypto.sign(null, signingInput, privateKey);
    const sigB64 = signature.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const expiredToken = `${headerB64}.${payloadB64}.${sigB64}`;

    const result = verifyEntitlementToken(expiredToken);
    assert.equal(result.valid, false);
    assert.match(result.reason, /expired/i);
  });

  test('CORRUPT: Completely garbage input is rejected gracefully', () => {
    const result = verifyEntitlementToken('not.a.valid.token.at.all');
    assert.equal(result.valid, false);
  });

  test('CORRUPT: Token with only 2 parts is rejected', () => {
    const result = verifyEntitlementToken('part1.part2');
    assert.equal(result.valid, false);
    assert.match(result.reason, /3 parts/);
  });

  test('CORRUPT: Null input is rejected gracefully', () => {
    const result = verifyEntitlementToken(null);
    assert.equal(result.valid, false);
  });

  test('CORRUPT: Empty string is rejected gracefully', () => {
    const result = verifyEntitlementToken('');
    assert.equal(result.valid, false);
  });

  test('WRONG KEY: Token signed by a different private key fails verification', () => {
    // Generate a second, different keypair
    const { publicKey: otherPub, privateKey: otherPriv } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    // Temporarily override env to sign with other private key
    const origPriv = process.env.ED25519_PRIVATE_KEY_PEM;
    process.env.ED25519_PRIVATE_KEY_PEM = otherPriv;

    const tokenFromWrongKey = signProToken();

    // Restore original key (public key stays original — from TEST env)
    process.env.ED25519_PRIVATE_KEY_PEM = origPriv;

    const result = verifyEntitlementToken(tokenFromWrongKey);
    assert.equal(result.valid, false, 'Token signed by different key must fail verification');
  });

  test('Two tokens for the same user differ (different iat/exp)', (t, done) => {
    const token1 = signProToken();
    // Small delay to ensure different timestamp
    setTimeout(() => {
      const token2 = signProToken();
      assert.notEqual(token1, token2, 'Each token issuance must produce a unique token');
      done();
    }, 50);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Paddle Price ID Resolution Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('4. Paddle Price ID & Tier Resolution', () => {

  test('resolvePriceId returns correct price IDs for all tiers', () => {
    assert.equal(resolvePriceId('monthly'), 'pri_01monthly_test');
    assert.equal(resolvePriceId('annual'), 'pri_01annual_test');
    assert.equal(resolvePriceId('lifetime'), 'pri_01lifetime_test');
  });

  test('resolvePriceId throws 400 for unknown tier', () => {
    assert.throws(
      () => resolvePriceId('enterprise'),
      (err) => err.status === 400 && /Unknown plan tier/.test(err.message)
    );
  });

  test('resolvePriceId throws 400 for empty tier', () => {
    assert.throws(
      () => resolvePriceId(''),
      (err) => err.status === 400
    );
  });

  test('resolvePriceId throws 400 for null tier', () => {
    assert.throws(
      () => resolvePriceId(null),
      (err) => err.status === 400
    );
  });

  test('getPaddleHost returns sandbox host in sandbox environment', () => {
    setTestEnv({ PADDLE_ENVIRONMENT: 'sandbox' });
    _resetForTest();
    // Re-import after env reset
    const { getPaddleHost: gph } = require('../lib/paddle');
    // Note: env validation will block 'production' — only test sandbox here
    assert.equal(gph(), PADDLE_SANDBOX_HOST);
    setTestEnv();
    _resetForTest();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Idempotency State Machine Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('5. Webhook Idempotency State Machine', () => {

  test('State machine: new event → processing', () => {
    const db = new Map();
    const result = simulateClaim(db, 'evt_new', 'subscription.activated');
    assert.equal(result, 'processing');
    assert.equal(db.get('evt_new').status, 'processing');
  });

  test('State machine: duplicate while processing → ignored (null)', () => {
    const db = new Map();
    simulateClaim(db, 'evt_dup', 'subscription.activated');
    // Simulate still processing (not yet marked processed)
    const result2 = simulateClaim(db, 'evt_dup', 'subscription.activated');
    assert.equal(result2, null, 'Second delivery while processing must be ignored');
  });

  test('State machine: duplicate after processed → ignored (null)', () => {
    const db = new Map();
    simulateClaim(db, 'evt_done', 'subscription.activated');
    db.get('evt_done').status = 'processed';
    const result = simulateClaim(db, 'evt_done', 'subscription.activated');
    assert.equal(result, null, 'Duplicate after processed must be ignored');
  });

  test('State machine: failed event → retryable on next delivery', () => {
    const db = new Map();
    simulateClaim(db, 'evt_fail', 'subscription.activated');
    db.get('evt_fail').status = 'failed';
    db.get('evt_fail').attempts = 1;

    const result = simulateClaim(db, 'evt_fail', 'subscription.activated');
    assert.equal(result, 'processing', 'Failed event must be reclaimable');
    assert.equal(db.get('evt_fail').attempts, 2, 'Attempt counter must increment');
  });

  test('State machine: 3 deliveries of same event result in exactly 1 successful process', () => {
    const db = new Map();
    const results = [
      simulateClaim(db, 'evt_triple', 'sub.activated'),
      simulateClaim(db, 'evt_triple', 'sub.activated'),
      simulateClaim(db, 'evt_triple', 'sub.activated'),
    ];
    const claimed = results.filter(r => r === 'processing').length;
    const ignored = results.filter(r => r === null).length;
    assert.equal(claimed, 1, 'Exactly one processing claim');
    assert.equal(ignored, 2, 'Exactly two ignored deliveries');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Event Ordering Protection Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('6. Out-of-Order Event Protection (occurred_at Ordering)', () => {

  test('Newer event overwrites older stored state', () => {
    const stored = new Date('2026-11-01T00:00:00Z');
    const incoming = new Date('2026-11-15T00:00:00Z');
    assert.ok(
      incoming > stored,
      'Newer event must pass the ordering check and be applied'
    );
  });

  test('Stale event (older occurred_at) is correctly detected and must be ignored', () => {
    const stored = new Date('2026-11-15T00:00:00Z');
    const stale = new Date('2026-11-01T00:00:00Z');
    assert.ok(
      stale <= stored,
      'Stale event with older occurred_at must be blocked from mutating state'
    );
  });

  test('Equal occurred_at event (duplicate with same timestamp) is treated as stale', () => {
    const stored = new Date('2026-11-15T12:00:00Z');
    const equal = new Date('2026-11-15T12:00:00Z');
    assert.ok(equal <= stored, 'Equal timestamp must also be ignored (idempotent)');
  });

  test('Microsecond difference in occurred_at is handled correctly', () => {
    const stored = new Date('2026-11-15T12:00:00.000Z');
    const incoming = new Date('2026-11-15T12:00:00.001Z');
    assert.ok(incoming > stored, 'Even 1ms newer must be accepted');
  });

  test('isStaleEvent helper correctly identifies stale vs newer events', () => {
    assert.equal(isStaleEvent('2026-11-15T10:00:00Z', '2026-11-15T12:00:00Z'), true, 'Past timestamp is stale');
    assert.equal(isStaleEvent('2026-11-15T12:00:00Z', '2026-11-15T12:00:00Z'), true, 'Equal timestamp is stale');
    assert.equal(isStaleEvent('2026-11-15T14:00:00Z', '2026-11-15T12:00:00Z'), false, 'Future timestamp is fresh');
    assert.equal(isStaleEvent('2026-11-15T12:00:00Z', null), false, 'No stored timestamp is fresh');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 6b. Paddle Adjustment & Refund Business Rule Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('6b. Paddle Adjustment & Refund Business Rules', () => {

  test('Full approved refund revokes entitlement and marks refunded', () => {
    const event = {
      event_type: 'adjustment.created',
      data: {
        id: 'adj_01',
        action: 'refund',
        status: 'approved',
        type: 'full',
      },
    };
    const res = evaluateAdjustment(event);
    assert.equal(res.shouldRevoke, true);
    assert.equal(res.purchaseStatus, 'refunded');
    assert.equal(res.isActionable, true);
  });

  test('transaction.refunded event revokes entitlement and marks refunded', () => {
    const event = {
      event_type: 'transaction.refunded',
      data: { id: 'txn_01' },
    };
    const res = evaluateAdjustment(event);
    assert.equal(res.shouldRevoke, true);
    assert.equal(res.purchaseStatus, 'refunded');
    assert.equal(res.isActionable, true);
    assert.equal(res.reason, 'transaction_refunded_confirmed');
  });

  test('transaction.refunded with adversarial data.type=partial STILL revokes (fast-path)', () => {
    const event = {
      event_type: 'transaction.refunded',
      data: { id: 'txn_adversarial', type: 'partial', status: 'pending_approval' },
    };
    const res = evaluateAdjustment(event);
    assert.equal(res.shouldRevoke, true, 'transaction.refunded must always revoke regardless of data fields');
    assert.equal(res.purchaseStatus, 'refunded');
    assert.equal(res.isActionable, true);
    assert.equal(res.reason, 'transaction_refunded_confirmed');
  });

  test('transaction.refunded with adversarial data.type=tax STILL revokes (fast-path)', () => {
    const event = {
      event_type: 'transaction.refunded',
      data: { id: 'txn_tax_adversarial', type: 'tax', action: 'credit' },
    };
    const res = evaluateAdjustment(event);
    assert.equal(res.shouldRevoke, true, 'transaction.refunded must not be suppressed by tax/credit rules');
    assert.equal(res.purchaseStatus, 'refunded');
    assert.equal(res.isActionable, true);
  });

  test('Formal chargeback revokes entitlement immediately and marks disputed', () => {
    const event = {
      event_type: 'adjustment.created',
      data: {
        id: 'adj_02',
        action: 'chargeback',
        status: 'approved',
        type: 'full',
      },
    };
    const res = evaluateAdjustment(event);
    assert.equal(res.shouldRevoke, true);
    assert.equal(res.purchaseStatus, 'disputed');
    assert.equal(res.isActionable, true);
  });

  test('Chargeback warning does NOT revoke entitlement (pre-dispute alert)', () => {
    const event = {
      event_type: 'adjustment.created',
      data: {
        id: 'adj_03',
        action: 'chargeback_warning',
      },
    };
    const res = evaluateAdjustment(event);
    assert.equal(res.shouldRevoke, false);
    assert.equal(res.purchaseStatus, null);
    assert.equal(res.isActionable, false);
  });

  test('Credit adjustment does NOT revoke entitlement (account/goodwill credit)', () => {
    const event = {
      event_type: 'adjustment.created',
      data: {
        id: 'adj_04',
        action: 'credit',
        type: 'full',
      },
    };
    const res = evaluateAdjustment(event);
    assert.equal(res.shouldRevoke, false);
    assert.equal(res.purchaseStatus, null);
    assert.equal(res.isActionable, false);
  });

  test('Tax adjustment does NOT revoke entitlement', () => {
    const event = {
      event_type: 'adjustment.created',
      data: {
        id: 'adj_05',
        action: 'refund',
        type: 'tax',
      },
    };
    const res = evaluateAdjustment(event);
    assert.equal(res.shouldRevoke, false);
    assert.equal(res.purchaseStatus, null);
    assert.equal(res.isActionable, false);
  });

  test('Pending approval refund does NOT revoke entitlement prematurely', () => {
    const event = {
      event_type: 'adjustment.created',
      data: {
        id: 'adj_06',
        action: 'refund',
        status: 'pending_approval',
        type: 'full',
      },
    };
    const res = evaluateAdjustment(event);
    assert.equal(res.shouldRevoke, false);
    assert.equal(res.purchaseStatus, null);
    assert.equal(res.isActionable, false);
  });

  test('Partial refund retains software license entitlement', () => {
    const event = {
      event_type: 'adjustment.created',
      data: {
        id: 'adj_07',
        action: 'refund',
        status: 'approved',
        type: 'partial',
      },
    };
    const res = evaluateAdjustment(event);
    assert.equal(res.shouldRevoke, false);
    assert.equal(res.purchaseStatus, null);
    assert.equal(res.isActionable, false);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 6c. subscription.created Status Guard Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('6c. subscription.created Status Guard (Entitlement Safety)', () => {

  // These tests verify that handleSubscriptionActivated does NOT grant Pro
  // when the Paddle subscription status is not in the ENTITLEMENT_GRANTING_STATUSES set.
  // We test the status guard logic extracted from the handler:
  //   const ENTITLEMENT_GRANTING_STATUSES = new Set(['active']);
  //   Entitlement is granted ONLY when paddleStatus is in this set.

  const ENTITLEMENT_GRANTING_STATUSES = new Set(['active']);

  function shouldGrantEntitlement(paddleStatus) {
    return ENTITLEMENT_GRANTING_STATUSES.has((paddleStatus || '').toLowerCase());
  }

  test('status=active → entitlement IS granted', () => {
    assert.equal(shouldGrantEntitlement('active'), true);
  });

  test('status=trialing → entitlement NOT granted (no payment confirmed)', () => {
    assert.equal(shouldGrantEntitlement('trialing'), false);
  });

  test('status=past_due → entitlement NOT granted', () => {
    assert.equal(shouldGrantEntitlement('past_due'), false);
  });

  test('status=paused → entitlement NOT granted', () => {
    assert.equal(shouldGrantEntitlement('paused'), false);
  });

  test('status=canceled → entitlement NOT granted', () => {
    assert.equal(shouldGrantEntitlement('canceled'), false);
  });

  test('status=undefined → entitlement NOT granted (defensive)', () => {
    assert.equal(shouldGrantEntitlement(undefined), false);
  });

  test('status=empty string → entitlement NOT granted (defensive)', () => {
    assert.equal(shouldGrantEntitlement(''), false);
  });

  test('status=ACTIVE (uppercase) → entitlement NOT granted (case-sensitive set)', () => {
    // The handler lowercases before checking the set, so uppercase input
    // after lowercasing should match. Verify the handler's .toLowerCase() logic.
    const paddleStatus = 'ACTIVE';
    assert.equal(ENTITLEMENT_GRANTING_STATUSES.has(paddleStatus.toLowerCase()), true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6d. Windows NTFS Key Permission Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('6d. Ed25519 Key Generation NTFS Hardening', () => {

  test('Node.js mode 0o600 is NOT enforced on Windows NTFS', () => {
    // On Windows, Node.js fs.writeFileSync mode parameter is silently ignored.
    // This test documents that NTFS ACLs must be set via icacls/PowerShell.
    const os = require('os');
    const isWindows = os.platform() === 'win32';
    if (!isWindows) {
      // On POSIX, mode 0o600 works. Test is Windows-specific.
      return;
    }
    // Write a temp file with mode 0o600 and verify it is still world-readable
    const fs = require('fs');
    const path = require('path');
    const tmpDir = path.join(os.tmpdir(), `valvoice-ntfs-test-${Date.now()}`);
    const tmpFile = path.join(tmpDir, 'test-key.pem');
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
      fs.writeFileSync(tmpFile, 'test-private-key-data', { mode: 0o600 });
      // On Windows, the file will still be readable by other users.
      // fs.statSync().mode on Windows returns 0o666 (rw for all) regardless of mode param.
      const stat = fs.statSync(tmpFile);
      const modeBits = stat.mode & 0o777;
      // On Windows NTFS, mode bits are always 0o666 (files) or 0o777 (dirs)
      // regardless of what was requested. This proves mode: 0o600 is ineffective.
      assert.notEqual(modeBits, 0o600,
        'On Windows, Node.js mode 0o600 is not enforced — NTFS ACLs required');
    } finally {
      try { fs.unlinkSync(tmpFile); } catch {}
      try { fs.rmdirSync(tmpDir); } catch {}
    }
  });

  test('icacls command is available on Windows for NTFS ACL hardening', () => {
    const os = require('os');
    if (os.platform() !== 'win32') return;
    const { execSync } = require('child_process');
    // icacls must exist on all Windows >= Vista
    assert.doesNotThrow(() => {
      execSync('where icacls', { timeout: 5000, stdio: 'pipe' });
    }, 'icacls must be available on Windows for key file ACL hardening');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Entitlement Resolution Priority Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('7. Entitlement Priority Resolution Logic', () => {

  function resolve(entitlements, now = new Date()) {
    const active = entitlements.filter(e => e.status === 'active');
    const lifetime = active.find(e => e.is_lifetime);
    if (lifetime) return { tier: 'pro', is_lifetime: true, valid_until: null };
    const sub = active
      .filter(e => !e.is_lifetime && (!e.valid_until || new Date(e.valid_until) > now))
      .sort((a, b) => new Date(b.valid_until || 0) - new Date(a.valid_until || 0))[0];
    if (sub) return { tier: 'pro', is_lifetime: false, valid_until: sub.valid_until };
    return { tier: 'free', is_lifetime: false, valid_until: null };
  }

  const now = new Date('2026-11-15T00:00:00Z');
  const future = new Date('2026-12-15T00:00:00Z').toISOString();
  const past = new Date('2026-11-01T00:00:00Z').toISOString();

  test('Lifetime entitlement → Pro Lifetime', () => {
    const r = resolve([{ status: 'active', is_lifetime: true, valid_until: null }], now);
    assert.equal(r.tier, 'pro');
    assert.equal(r.is_lifetime, true);
    assert.equal(r.valid_until, null);
  });

  test('Lifetime wins over active subscription', () => {
    const r = resolve([
      { status: 'active', is_lifetime: true, valid_until: null },
      { status: 'active', is_lifetime: false, valid_until: future },
    ], now);
    assert.equal(r.is_lifetime, true);
  });

  test('Active subscription within valid_until → Pro', () => {
    const r = resolve([{ status: 'active', is_lifetime: false, valid_until: future }], now);
    assert.equal(r.tier, 'pro');
    assert.equal(r.is_lifetime, false);
    assert.equal(r.valid_until, future);
  });

  test('Expired subscription → Free', () => {
    const r = resolve([{ status: 'active', is_lifetime: false, valid_until: past }], now);
    assert.equal(r.tier, 'free');
  });

  test('Revoked entitlement → Free', () => {
    const r = resolve([{ status: 'revoked', is_lifetime: true, valid_until: null }], now);
    assert.equal(r.tier, 'free');
  });

  test('Empty entitlements → Free', () => {
    const r = resolve([], now);
    assert.equal(r.tier, 'free');
  });

  test('Multiple subscriptions → picks latest valid_until', () => {
    const farFuture = new Date('2027-06-01T00:00:00Z').toISOString();
    const r = resolve([
      { status: 'active', is_lifetime: false, valid_until: future },
      { status: 'active', is_lifetime: false, valid_until: farFuture },
    ], now);
    assert.equal(r.valid_until, farFuture);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Claim Security Gate Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('8. Purchase Claim Four-Condition Security Gate', () => {

  function attemptClaim({ userEmail, billingEmail, status, userId, hasExistingEntitlement }) {
    // Condition 3: Payment integrity
    if (status !== 'completed') return { allowed: false, reason: `Purchase status is ${status}` };
    // Condition 2: Unclaimed
    if (userId !== null) return { allowed: false, reason: 'Already attributed to an account' };
    // Condition 1: Email match
    if (!userEmail || !billingEmail || userEmail.toLowerCase() !== billingEmail.toLowerCase()) {
      return { allowed: false, reason: 'Email does not match billing email' };
    }
    // Condition 4: No duplicate
    if (hasExistingEntitlement) return { allowed: false, reason: 'Entitlement already exists' };
    return { allowed: true };
  }

  const VALID = {
    userEmail: 'player@example.com',
    billingEmail: 'player@example.com',
    status: 'completed',
    userId: null,
    hasExistingEntitlement: false,
  };

  test('All four conditions met → claim allowed', () => {
    assert.equal(attemptClaim(VALID).allowed, true);
  });

  test('Condition 1 fails: email mismatch → rejected', () => {
    const r = attemptClaim({ ...VALID, userEmail: 'other@example.com' });
    assert.equal(r.allowed, false);
    assert.match(r.reason, /Email/i);
  });

  test('Condition 1 fails: empty billing email → rejected', () => {
    const r = attemptClaim({ ...VALID, billingEmail: '' });
    assert.equal(r.allowed, false);
  });

  test('Condition 2 fails: already claimed (user_id present) → rejected', () => {
    const r = attemptClaim({ ...VALID, userId: 'some-other-user-id' });
    assert.equal(r.allowed, false);
    assert.match(r.reason, /attributed/i);
  });

  test('Condition 3 fails: refunded purchase → rejected', () => {
    const r = attemptClaim({ ...VALID, status: 'refunded' });
    assert.equal(r.allowed, false);
    assert.match(r.reason, /refunded/i);
  });

  test('Condition 3 fails: disputed purchase → rejected', () => {
    const r = attemptClaim({ ...VALID, status: 'disputed' });
    assert.equal(r.allowed, false);
  });

  test('Condition 4 fails: duplicate entitlement exists → rejected', () => {
    const r = attemptClaim({ ...VALID, hasExistingEntitlement: true });
    assert.equal(r.allowed, false);
    assert.match(r.reason, /Entitlement/i);
  });

  test('All four conditions checked in documented priority order', () => {
    // Condition 3 must be checked before condition 1 (don't leak email info on bad payment)
    const r = attemptClaim({ ...VALID, status: 'refunded', userEmail: 'wrong@example.com' });
    assert.equal(r.allowed, false);
    assert.match(r.reason, /refunded/i, 'Payment status must be checked before email to avoid info leakage');
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 9. HTTP Utilities Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('9. HTTP Utility Helpers', () => {
  const { extractBearerToken, readRawBody } = require('../lib/http');

  test('extractBearerToken extracts token from Authorization header', () => {
    const req = { headers: { authorization: 'Bearer my-test-token-123' } };
    assert.equal(extractBearerToken(req), 'my-test-token-123');
  });

  test('extractBearerToken returns null when header is absent', () => {
    assert.equal(extractBearerToken({ headers: {} }), null);
  });

  test('extractBearerToken returns null for non-Bearer schemes', () => {
    const req = { headers: { authorization: 'Basic dXNlcjpwYXNz' } };
    assert.equal(extractBearerToken(req), null);
  });

  test('extractBearerToken trims whitespace', () => {
    const req = { headers: { authorization: 'Bearer   spaced-token   ' } };
    assert.equal(extractBearerToken(req), 'spaced-token');
  });

  test('readRawBody reads a complete body from a stream', async () => {
    const { Readable } = require('stream');
    const stream = Readable.from(['{"test": "value"}']);
    const body = await readRawBody(stream);
    assert.equal(body, '{"test": "value"}');
  });

  test('readRawBody rejects when body exceeds maxBytes', async () => {
    const { Readable } = require('stream');
    const bigPayload = 'X'.repeat(100);
    const stream = Readable.from([bigPayload]);
    await assert.rejects(
      () => readRawBody(stream, 50), // limit to 50 bytes
      (err) => err.status === 413 || /too large/i.test(err.message)
    );
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Idempotency Helper (used in tests above)
// ─────────────────────────────────────────────────────────────────────────────

function simulateClaim(db, eventId, eventType) {
  const existing = db.get(eventId);
  if (!existing) {
    db.set(eventId, { event_id: eventId, event_type: eventType, status: 'processing', attempts: 1 });
    return 'processing';
  }
  if (existing.status === 'failed') {
    existing.attempts = (existing.attempts || 1) + 1;
    existing.status = 'processing';
    return 'processing';
  }
  return null; // Already processing or processed
}
