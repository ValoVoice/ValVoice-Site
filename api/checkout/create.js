/**
 * POST /api/checkout/create
 *
 * Creates a Paddle Sandbox checkout transaction for an authenticated user.
 * The user's Supabase UUID is embedded in custom_data so the subsequent
 * webhook can deterministically attribute the purchase.
 *
 * Request:
 *   POST /api/checkout/create
 *   Authorization: Bearer <supabase_access_token>
 *   Content-Type: application/json
 *   Body: { "tier": "monthly" | "annual" | "lifetime", "installation_id": "<uuid>" }
 *
 * Response 200:
 *   { "checkout_url": "https://sandbox-buy.paddle.com/...", "transaction_id": "txn_..." }
 *
 * Response 4xx/5xx:
 *   { "error": "<description>" }
 *
 * Security:
 *   - Requires a valid Supabase JWT (server-side verified, not decoded client-side).
 *   - Tier is mapped server-side to a price_id. Client cannot supply arbitrary price IDs.
 *   - Paddle environment is locked to sandbox via PADDLE_ENVIRONMENT env var.
 */

'use strict';

const { validateEnv } = require('../../lib/env');
const { verifyUserToken } = require('../../lib/supabase');
const { createCheckoutTransaction, resolvePriceId } = require('../../lib/paddle');
const { json, handleMethodAndCors, extractBearerToken, readRawBody, withErrorHandling } = require('../../lib/http');

validateEnv();

/** Allowed plan tiers for checkout. */
const VALID_TIERS = new Set(['monthly', 'annual', 'lifetime']);

/** UUID v4 regex for loose validation of installation_id */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = withErrorHandling(async (req, res) => {
  if (handleMethodAndCors(req, res, ['POST'])) return;

  // 1. Authenticate the caller
  const accessToken = extractBearerToken(req);
  if (!accessToken) {
    return json(res, 401, { error: 'Authorization header required' });
  }

  const user = await verifyUserToken(accessToken);
  // user.id is the verified Supabase auth.users.id UUID

  // 2. Parse and validate the request body
  const rawBody = await readRawBody(req, 4096);
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json(res, 400, { error: 'Request body must be valid JSON' });
  }

  const { tier, installation_id } = body;

  if (!tier || !VALID_TIERS.has(tier)) {
    return json(res, 400, {
      error: `Invalid plan tier. Must be one of: ${[...VALID_TIERS].join(', ')}`,
    });
  }

  // Validate installation_id format if provided (optional field — analytics only)
  const installationId = installation_id && UUID_REGEX.test(installation_id)
    ? installation_id
    : null;

  // 3. Validate that the requested price_id is configured (early failure before Paddle call)
  resolvePriceId(tier); // throws 400 if not configured

  // 4. Create Paddle checkout transaction
  // We pass the user's email from the verified Supabase token to pre-fill the checkout
  const { checkoutUrl, transactionId } = await createCheckoutTransaction({
    tier,
    supabaseUserId: user.id,
    installationId,
    customerEmail: user.email || null,
  });

  console.log(`[Checkout] Created transaction ${transactionId} for user ${user.id} tier=${tier}`);

  return json(res, 200, {
    checkout_url: checkoutUrl,
    transaction_id: transactionId,
    tier,
  });
});
