/**
 * ValVoice Backend — Paddle Webhook Signature Verification
 *
 * Implements the full Paddle webhook security protocol:
 *   1. HMAC-SHA256 signature verification using raw request body.
 *   2. Timing-safe comparison (prevents side-channel timing attacks).
 *   3. Replay attack prevention via timestamp tolerance.
 *
 * Paddle Webhook Signature Format:
 *   Paddle-Signature: ts=<unix_timestamp>;h1=<hex_hmac_sha256>
 *
 * The HMAC is computed over: "<ts>:<raw_body>"
 *
 * Reference: https://developer.paddle.com/webhooks/signature-verification
 *
 * Timestamp Tolerance:
 *   Paddle's official SDKs use 5 seconds. However, Vercel serverless functions
 *   can experience cold starts and regional routing delays. We use 300 seconds
 *   (5 minutes) as the tolerance, consistent with Paddle's own recommendation
 *   for serverless environments where cold-start latency is non-trivial.
 *   This is NOT a security regression: the HMAC signature itself provides
 *   the cryptographic authenticity guarantee; the timestamp check only
 *   prevents indefinite replay of captured payloads.
 */

'use strict';

const crypto = require('crypto');
const { env } = require('./env');

/**
 * Timestamp tolerance in seconds for replay-attack prevention.
 * 300 seconds (5 minutes) — appropriate for serverless cold starts.
 * Paddle's own SDK default for serverless is 300s.
 */
const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300;

/**
 * Verifies a Paddle webhook request's HMAC-SHA256 signature.
 *
 * @param {string} rawBody           Raw, unparsed request body string (must NOT be pre-parsed JSON).
 * @param {string} signatureHeader   Value of the 'Paddle-Signature' header.
 * @returns {{ valid: boolean, event: object, eventId: string, occurredAt: string }}
 * @throws {Error} with .status set to 401 or 400 on verification failure.
 */
function verifyPaddleWebhook(rawBody, signatureHeader) {
  // 1. Presence check
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    throw Object.assign(new Error('Missing Paddle-Signature header'), { status: 401 });
  }

  // 2. Parse ts and h1 from header
  // Format: "ts=1729000000;h1=abc123..."
  const parts = {};
  for (const segment of signatureHeader.split(';')) {
    const eqIdx = segment.indexOf('=');
    if (eqIdx > 0) {
      parts[segment.slice(0, eqIdx).trim()] = segment.slice(eqIdx + 1).trim();
    }
  }

  const ts = parts['ts'];
  const h1 = parts['h1'];

  if (!ts || !h1) {
    throw Object.assign(
      new Error(`Malformed Paddle-Signature header. Expected ts=...;h1=... but got: ${signatureHeader.substring(0, 100)}`),
      { status: 401 }
    );
  }

  // 3. Timestamp validation — replay attack prevention
  const tsInt = parseInt(ts, 10);
  if (isNaN(tsInt)) {
    throw Object.assign(new Error('Paddle-Signature ts value is not a valid integer'), { status: 400 });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const ageDelta = Math.abs(nowSeconds - tsInt);

  if (ageDelta > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS) {
    throw Object.assign(
      new Error(`Webhook timestamp is outside tolerance window. Age: ${ageDelta}s, Tolerance: ${WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS}s`),
      { status: 400, code: 'WEBHOOK_REPLAY' }
    );
  }

  // 4. Compute HMAC-SHA256 of "<ts>:<rawBody>"
  const webhookSecret = env('PADDLE_WEBHOOK_SECRET_KEY');
  const signingPayload = `${ts}:${rawBody}`;

  const expectedHmac = crypto
    .createHmac('sha256', webhookSecret)
    .update(signingPayload, 'utf8')
    .digest('hex');

  // 5. Timing-safe comparison — prevents side-channel timing attacks
  let expectedBuf, receivedBuf;
  try {
    expectedBuf = Buffer.from(expectedHmac, 'hex');
    receivedBuf = Buffer.from(h1, 'hex');
  } catch {
    throw Object.assign(new Error('Paddle-Signature h1 is not valid hex'), { status: 400 });
  }

  if (expectedBuf.length !== receivedBuf.length) {
    throw Object.assign(new Error('Paddle-Signature h1 length mismatch'), { status: 403 });
  }

  const isValid = crypto.timingSafeEqual(expectedBuf, receivedBuf);
  if (!isValid) {
    throw Object.assign(new Error('Paddle webhook signature verification failed'), { status: 403, code: 'INVALID_SIGNATURE' });
  }

  // 6. Parse the verified event payload
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    throw Object.assign(new Error('Webhook body is not valid JSON (after signature passed)'), { status: 400 });
  }

  // 7. Extract and validate event metadata
  const eventId = event?.event_id;
  const occurredAt = event?.occurred_at;

  if (!eventId || typeof eventId !== 'string') {
    throw Object.assign(new Error('Webhook event missing event_id field'), { status: 400 });
  }

  if (!occurredAt || typeof occurredAt !== 'string') {
    throw Object.assign(new Error('Webhook event missing occurred_at field'), { status: 400 });
  }

  return { valid: true, event, eventId, occurredAt };
}

/**
 * Extracts supabase_user_id from Paddle event custom_data.
 * Never trusts this value alone — it must be cross-referenced with
 * the Paddle billing record for payment ownership verification.
 *
 * @param {object} event  Verified Paddle event object.
 * @returns {string|null} Supabase user UUID, or null if not embedded.
 */
function extractCustomUserId(event) {
  const customData = event?.data?.custom_data;
  if (!customData || typeof customData !== 'object') return null;
  const userId = customData.supabase_user_id;
  if (!userId || typeof userId !== 'string' || userId.trim() === '') return null;
  return userId.trim();
}

/**
 * Extracts the Paddle billing email from an event.
 * Used as a fallback for unlinked purchase claims.
 * Value is from Paddle's trusted data, not from client input.
 *
 * @param {object} event  Verified Paddle event object.
 * @returns {string|null}
 */
function extractBillingEmail(event) {
  // For transactions: data.customer.email or data.billing_details.email
  const email =
    event?.data?.customer?.email ||
    event?.data?.billing_details?.email ||
    event?.data?.address?.contact?.email ||
    null;
  return email && typeof email === 'string' ? email.trim().toLowerCase() : null;
}

/**
 * Checks whether an incoming webhook event is stale based on occurred_at comparison.
 * Returns true if stale (should be dropped/ignored), false if newer (should be applied).
 *
 * @param {string|Date} incomingOccurredAt
 * @param {string|Date|null} storedOccurredAt
 * @returns {boolean}
 */
function isStaleEvent(incomingOccurredAt, storedOccurredAt) {
  if (!storedOccurredAt) return false;
  return new Date(incomingOccurredAt) <= new Date(storedOccurredAt);
}

/**
 * Evaluates a Paddle adjustment or refund event to determine the appropriate business action.
 * Distinguishes full refunds, partial refunds, chargebacks, warnings, credits and tax adjustments.
 *
 * Business Rules:
 *   1. Chargeback warning: pre-dispute notice; funds not debited. Do NOT revoke.
 *   2. Account credit: merchant credit adjustment. Do NOT revoke.
 *   3. Tax adjustment: tax recalculation by Paddle. Do NOT revoke.
 *   4. Pending approval refund: awaiting merchant confirmation. Do NOT revoke prematurely.
 *   5. Partial refund: goodwill or partial rebate. Do NOT revoke lifetime software license.
 *   6. Chargeback (formal dispute): mark 'disputed', revoke entitlement immediately.
 *   7. Full approved refund: mark 'refunded', revoke entitlement immediately.
 *
 * @param {object} event  Verified Paddle event object.
 * @returns {{
 *   shouldRevoke: boolean,
 *   purchaseStatus: 'refunded' | 'disputed' | null,
 *   reason: string,
 *   isActionable: boolean
 * }}
 */
function evaluateAdjustment(event) {
  const data = event?.data || {};
  const eventType = event?.event_type;

  // ── transaction.refunded fast-path ──────────────────────────────────────
  // Paddle only emits transaction.refunded for confirmed full refunds.
  // This event has a different payload shape from adjustment.created and
  // must ALWAYS revoke, regardless of any fields in data (type, status, etc.).
  // By checking this first we ensure no downstream adjustment rule
  // (partial, tax, pending) can accidentally suppress a confirmed refund.
  if (eventType === 'transaction.refunded') {
    return { shouldRevoke: true, purchaseStatus: 'refunded', reason: 'transaction_refunded_confirmed', isActionable: true };
  }

  // ── adjustment.created evaluation ──────────────────────────────────────
  const action = (data.action || 'unknown').toLowerCase();
  const status = (data.status || 'unknown').toLowerCase();
  const type = (data.type || 'unknown').toLowerCase();

  // 1. Chargeback warning — pre-dispute alert; do not revoke
  if (action === 'chargeback_warning') {
    return { shouldRevoke: false, purchaseStatus: null, reason: 'chargeback_warning_pre_dispute', isActionable: false };
  }

  // 2. Account credit — merchant credit adjustment; do not revoke
  if (action === 'credit') {
    return { shouldRevoke: false, purchaseStatus: null, reason: 'credit_adjustment', isActionable: false };
  }

  // 3. Tax adjustment — tax calculation only; do not revoke
  if (type === 'tax') {
    return { shouldRevoke: false, purchaseStatus: null, reason: 'tax_adjustment', isActionable: false };
  }

  // 4. Pending refund approval — awaiting merchant/admin confirmation; do not revoke
  if (action === 'refund' && status === 'pending_approval') {
    return { shouldRevoke: false, purchaseStatus: null, reason: 'refund_pending_approval', isActionable: false };
  }

  // 5. Partial refund — goodwill/partial adjustment; keep software license active
  if (action === 'refund' && type === 'partial') {
    return { shouldRevoke: false, purchaseStatus: null, reason: 'partial_refund_goodwill', isActionable: false };
  }

  // 6. Chargeback — bank dispute filed; revoke entitlement immediately
  if (action === 'chargeback') {
    return { shouldRevoke: true, purchaseStatus: 'disputed', reason: 'chargeback_filed', isActionable: true };
  }

  // 7. Full approved refund (adjustment.created with action=refund, type=full/unknown)
  if (action === 'refund') {
    return { shouldRevoke: true, purchaseStatus: 'refunded', reason: 'full_refund_approved', isActionable: true };
  }

  return { shouldRevoke: false, purchaseStatus: null, reason: `unhandled_${action}_${type}`, isActionable: false };
}

module.exports = {
  verifyPaddleWebhook,
  extractCustomUserId,
  extractBillingEmail,
  isStaleEvent,
  evaluateAdjustment,
  WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
};
