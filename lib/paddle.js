/**
 * ValVoice Backend — Paddle Sandbox API Client
 *
 * Provides typed wrappers for Paddle Billing API v1 operations required
 * for ValVoice: creating checkout transactions, fetching subscriptions
 * and transactions for server-side reconciliation.
 *
 * SANDBOX ONLY. The env guard in lib/env.js prevents production use.
 * https://developer.paddle.com/api-reference/overview
 */

'use strict';

const https = require('https');
const { env } = require('./env');

/** Paddle Sandbox API base hostname */
const PADDLE_SANDBOX_HOST = 'sandbox-api.paddle.com';
/** Paddle Production API base hostname (blocked by env guard) */
const PADDLE_PRODUCTION_HOST = 'api.paddle.com';

/** Map of tier names to environment variable keys holding price IDs */
const TIER_TO_PRICE_ENV = {
  monthly: 'PADDLE_PRICE_MONTHLY',
  annual: 'PADDLE_PRICE_ANNUAL',
  lifetime: 'PADDLE_PRICE_LIFETIME',
};

/**
 * Returns the Paddle API hostname for the current environment.
 * @returns {string}
 */
function getPaddleHost() {
  const paddleEnv = env('PADDLE_ENVIRONMENT').toLowerCase();
  return paddleEnv === 'production' ? PADDLE_PRODUCTION_HOST : PADDLE_SANDBOX_HOST;
}

/**
 * Resolves a Paddle price_id from a tier name.
 * Rejects unknown tiers — never trusts client-supplied price IDs.
 *
 * @param {'monthly'|'annual'|'lifetime'} tier
 * @returns {string} Paddle price_id (e.g. 'pri_01...')
 * @throws {Error} If tier is unrecognised.
 */
function resolvePriceId(tier) {
  const envKey = TIER_TO_PRICE_ENV[tier];
  if (!envKey) {
    throw Object.assign(
      new Error(`Unknown plan tier: "${tier}". Must be one of: ${Object.keys(TIER_TO_PRICE_ENV).join(', ')}`),
      { status: 400 }
    );
  }
  const priceId = env(envKey);
  if (!priceId || !priceId.startsWith('pri_')) {
    throw Object.assign(
      new Error(`Invalid Paddle price_id configuration for tier "${tier}". Expected format: pri_...`),
      { status: 500 }
    );
  }
  return priceId;
}

/**
 * Creates a Paddle Checkout Transaction (Sandbox).
 * Binds the authenticated user's Supabase UUID in custom_data so the
 * webhook processor can deterministically attribute the purchase.
 *
 * @param {object} opts
 * @param {'monthly'|'annual'|'lifetime'} opts.tier
 * @param {string} opts.supabaseUserId  Supabase auth.users.id UUID.
 * @param {string} opts.installationId  Client installation UUID (optional — for analytics only).
 * @param {string} [opts.customerEmail] Pre-fill Paddle checkout email if known.
 * @returns {Promise<{checkoutUrl: string, transactionId: string}>}
 */
async function createCheckoutTransaction({ tier, supabaseUserId, installationId, customerEmail }) {
  const priceId = resolvePriceId(tier);

  const payload = {
    items: [{ price_id: priceId, quantity: 1 }],
    custom_data: {
      supabase_user_id: supabaseUserId,
      installation_id: installationId || null,
      tier,
    },
    checkout: {
      url: 'https://valvoice.app/checkout/success',
    },
  };

  if (customerEmail) {
    payload.customer = { email: customerEmail };
  }

  const response = await _paddleRequest('POST', '/transactions', payload);

  const data = response?.data;
  if (!data?.id) {
    throw new Error('[Paddle] Transaction creation response missing data.id');
  }

  // Paddle checkout URL is in data.checkout.url
  const checkoutUrl = data.checkout?.url;
  if (!checkoutUrl) {
    throw new Error('[Paddle] Transaction creation response missing checkout.url');
  }

  return {
    checkoutUrl,
    transactionId: data.id,
  };
}

/**
 * Fetches a subscription from Paddle by ID.
 * Used for server-side reconciliation — never trust client-supplied status.
 *
 * @param {string} subscriptionId  Paddle subscription ID (sub_...)
 * @returns {Promise<object>}      Paddle subscription data object.
 */
async function getSubscription(subscriptionId) {
  if (!subscriptionId || !subscriptionId.startsWith('sub_')) {
    throw Object.assign(new Error(`Invalid subscription ID format: ${subscriptionId}`), { status: 400 });
  }
  const response = await _paddleRequest('GET', `/subscriptions/${encodeURIComponent(subscriptionId)}`);
  if (!response?.data) {
    throw new Error(`[Paddle] No data returned for subscription ${subscriptionId}`);
  }
  return response.data;
}

/**
 * Fetches a transaction from Paddle by ID.
 * Used for server-side reconciliation of one-time purchases.
 *
 * @param {string} transactionId  Paddle transaction ID (txn_...)
 * @returns {Promise<object>}     Paddle transaction data object.
 */
async function getTransaction(transactionId) {
  if (!transactionId || !transactionId.startsWith('txn_')) {
    throw Object.assign(new Error(`Invalid transaction ID format: ${transactionId}`), { status: 400 });
  }
  const response = await _paddleRequest('GET', `/transactions/${encodeURIComponent(transactionId)}`);
  if (!response?.data) {
    throw new Error(`[Paddle] No data returned for transaction ${transactionId}`);
  }
  return response.data;
}

/**
 * Internal HTTPS request helper for Paddle API.
 * @private
 */
function _paddleRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const apiKey = env('PADDLE_API_KEY');
    const host = getPaddleHost();

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const bodyStr = body !== null ? JSON.stringify(body) : null;
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const options = {
      hostname: host,
      port: 443,
      path,
      method,
      headers,
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(data ? JSON.parse(data) : null);
          } catch {
            resolve(data);
          }
        } else {
          let errBody;
          try { errBody = JSON.parse(data); } catch { errBody = { raw: data.substring(0, 500) }; }
          const err = new Error(`[Paddle] HTTP ${res.statusCode} on ${method} ${path}: ${errBody?.error?.detail || errBody?.raw || 'Unknown error'}`);
          err.status = res.statusCode;
          err.paddleError = errBody;
          reject(err);
        }
      });
    });

    req.on('timeout', () => req.destroy(new Error(`[Paddle] Request timeout: ${method} ${path}`)));
    req.on('error', e => reject(new Error(`[Paddle] Network error on ${method} ${path}: ${e.message}`)));

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  createCheckoutTransaction,
  getSubscription,
  getTransaction,
  resolvePriceId,
  getPaddleHost,
  PADDLE_SANDBOX_HOST,
};
