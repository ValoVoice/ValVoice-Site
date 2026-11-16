/**
 * POST /api/entitlements/claim
 *
 * Fallback: Claims an unlinked Paddle transaction for an authenticated user.
 * This endpoint handles purchases made without an active session (e.g. a user
 * purchased directly from a Paddle link without signing in first).
 *
 * Four-condition security gate (ALL must pass for a claim to succeed):
 *   1. Email match:  Authenticated user's verified Supabase email ===
 *                    billing email on the Paddle transaction (from our DB,
 *                    sourced from Paddle webhook — never from client input).
 *   2. Unclaimed:    purchase.user_id IS NULL (not already attributed).
 *   3. Completed:    purchase.status = 'completed' (refunded/disputed are blocked).
 *   4. No duplicate: No active entitlement from this purchase already exists.
 *
 * Request:
 *   POST /api/entitlements/claim
 *   Authorization: Bearer <supabase_access_token>
 *   Content-Type: application/json
 *   Body: { "transaction_id": "txn_..." }
 *
 * Response 200:
 *   { "claimed": true, "tier": "pro", "is_lifetime": true }
 *
 * Response 403:
 *   { "error": "<reason>" }
 */

'use strict';

const { validateEnv } = require('../../lib/env');
const { verifyUserToken, rpc, query } = require('../../lib/supabase');
const { json, handleMethodAndCors, extractBearerToken, readRawBody, withErrorHandling } = require('../../lib/http');

validateEnv();

/** Paddle transaction ID format */
const TXN_ID_REGEX = /^txn_[a-zA-Z0-9]+$/;

module.exports = withErrorHandling(async (req, res) => {
  if (handleMethodAndCors(req, res, ['POST'])) return;

  // 1. Authenticate caller
  const accessToken = extractBearerToken(req);
  if (!accessToken) {
    return json(res, 401, { error: 'Authorization header required' });
  }

  const user = await verifyUserToken(accessToken);

  // 2. Parse request body
  const rawBody = await readRawBody(req, 4096);
  let body;
  try { body = JSON.parse(rawBody); } catch {
    return json(res, 400, { error: 'Request body must be valid JSON' });
  }

  const { transaction_id } = body;

  if (!transaction_id || !TXN_ID_REGEX.test(transaction_id)) {
    return json(res, 400, { error: 'Invalid or missing transaction_id. Expected format: txn_...' });
  }

  // 3. Fetch the purchase record — sourced from our DB (originally from Paddle webhook)
  //    We NEVER call Paddle API here: Paddle's webhook is the trust anchor.
  const purchases = await query('purchases', 'GET',
    `id=eq.${encodeURIComponent(transaction_id)}&select=id,user_id,customer_email,status,is_lifetime,subscription_id`
  );

  const purchase = purchases?.[0];

  if (!purchase) {
    return json(res, 404, { error: 'Transaction not found. Please wait for payment confirmation or contact support.' });
  }

  // --- FOUR-CONDITION SECURITY GATE ---

  // Condition 3: Payment integrity — must be completed
  if (purchase.status !== 'completed') {
    return json(res, 403, {
      error: `Purchase is not in a claimable state (status: ${purchase.status}).`,
    });
  }

  // Condition 2: Unclaimed — must not already have a user_id
  if (purchase.user_id !== null && purchase.user_id !== undefined) {
    if (purchase.user_id === user.id) {
      return json(res, 409, { error: 'This purchase is already attributed to your account.' });
    }
    return json(res, 403, { error: 'This purchase is already attributed to another account.' });
  }

  // Condition 1: Email match — user's verified email vs billing email (from Paddle webhook)
  const userEmail = (user.email || '').trim().toLowerCase();
  const billingEmail = (purchase.customer_email || '').trim().toLowerCase();

  if (!userEmail || !billingEmail) {
    return json(res, 403, { error: 'Email verification required to claim this purchase.' });
  }

  if (userEmail !== billingEmail) {
    // Do NOT reveal which email is on the purchase — prevents enumeration
    return json(res, 403, { error: 'The authenticated account email does not match the billing email for this purchase.' });
  }

  // Condition 4: No duplicate grant — no active entitlement from this transaction already
  const existingEntitlements = await query('entitlements', 'GET',
    `user_id=eq.${user.id}&source_id=eq.${encodeURIComponent(transaction_id)}&status=eq.active&select=id`
  );

  if (existingEntitlements?.length > 0) {
    return json(res, 409, { error: 'An active entitlement from this purchase already exists on your account.' });
  }

  // 4. All four conditions passed — atomically bind purchase and grant entitlement
  // Update purchase: link to user
  await query('purchases', 'PATCH',
    `id=eq.${encodeURIComponent(transaction_id)}&user_id=is.null`,
    { user_id: user.id }
  );

  // Grant entitlement
  const isLifetime = purchase.is_lifetime === true;
  await query('entitlements', 'POST', '', {
    user_id: user.id,
    tier: 'pro',
    source_type: isLifetime ? 'lifetime' : 'subscription',
    source_id: transaction_id,
    status: 'active',
    is_lifetime: isLifetime,
    valid_from: new Date().toISOString(),
    valid_until: isLifetime ? null : null, // Subscription valid_until will be set by subscription webhooks
    last_verified_at: new Date().toISOString(),
  }, 'return=minimal');

  // Ensure profile exists
  await rpc('ensure_profile', { p_user_id: user.id });

  console.log(`[Claim] User ${user.id} successfully claimed transaction ${transaction_id} (lifetime=${isLifetime})`);

  return json(res, 200, {
    claimed: true,
    tier: 'pro',
    is_lifetime: isLifetime,
  });
});
