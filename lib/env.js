/**
 * ValVoice Backend — Environment Variable Validation
 *
 * Validates that all required environment variables are present on startup.
 * Throws a descriptive error immediately rather than failing silently at
 * the first API call. Never logs secret values.
 */

'use strict';

/** All environment variables required for backend operation. */
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PADDLE_API_KEY',
  'PADDLE_WEBHOOK_SECRET_KEY',
  'PADDLE_ENVIRONMENT',
  'PADDLE_PRICE_MONTHLY',
  'PADDLE_PRICE_ANNUAL',
  'PADDLE_PRICE_LIFETIME',
  'ED25519_PRIVATE_KEY_PEM',
  'ED25519_PUBLIC_KEY_PEM',
  'ENTITLEMENT_TOKEN_TTL_SECONDS',
];

/** Variables that must not be exposed in error messages (even their existence). */
const SENSITIVE_VARS = new Set([
  'SUPABASE_SERVICE_ROLE_KEY',
  'PADDLE_API_KEY',
  'PADDLE_WEBHOOK_SECRET_KEY',
  'ED25519_PRIVATE_KEY_PEM',
]);

let _validated = false;

/**
 * Validates all required environment variables are present and non-empty.
 * Safe to call multiple times — only validates once per process lifetime.
 * @throws {Error} If any required variable is missing or empty.
 */
function validateEnv() {
  if (_validated) return;

  const missing = REQUIRED_ENV.filter(key => {
    const val = process.env[key];
    return val === undefined || val.trim() === '';
  });

  if (missing.length > 0) {
    const safeMissing = missing.filter(k => !SENSITIVE_VARS.has(k));
    const sensitiveMissing = missing.filter(k => SENSITIVE_VARS.has(k));
    const parts = [];
    if (safeMissing.length) parts.push(`Missing: ${safeMissing.join(', ')}`);
    if (sensitiveMissing.length) parts.push(`${sensitiveMissing.length} sensitive variable(s) missing (names redacted)`);
    throw new Error(`[ValVoice] Environment configuration error. ${parts.join('. ')}`);
  }

  // Validate PADDLE_ENVIRONMENT is exactly 'sandbox' or 'production'
  const paddleEnv = process.env.PADDLE_ENVIRONMENT.trim().toLowerCase();
  if (paddleEnv !== 'sandbox' && paddleEnv !== 'production') {
    throw new Error('[ValVoice] PADDLE_ENVIRONMENT must be "sandbox" or "production"');
  }

  // Guard: Block production Paddle in this codebase until explicitly enabled
  if (paddleEnv === 'production') {
    throw new Error('[ValVoice] Live Paddle production payments are not enabled in this build. Set PADDLE_ENVIRONMENT=sandbox.');
  }

  // Validate TTL is a positive integer
  const ttl = parseInt(process.env.ENTITLEMENT_TOKEN_TTL_SECONDS, 10);
  if (isNaN(ttl) || ttl < 3600) {
    throw new Error('[ValVoice] ENTITLEMENT_TOKEN_TTL_SECONDS must be a positive integer >= 3600 (1 hour)');
  }

  _validated = true;
}

/**
 * Returns a validated environment variable value.
 * @param {string} key
 * @returns {string}
 */
function env(key) {
  validateEnv();
  return process.env[key].trim();
}

/**
 * Resets validation state for testing only.
 * @internal
 */
function _resetForTest() {
  _validated = false;
}

module.exports = { validateEnv, env, _resetForTest };
