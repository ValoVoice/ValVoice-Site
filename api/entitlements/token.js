/**
 * GET /api/entitlements/token
 *
 * Issues a signed Ed25519 entitlement token for an authenticated user.
 * The token encodes the user's current plan tier and is cached locally
 * in the desktop application for offline operation.
 *
 * Request:
 *   GET /api/entitlements/token
 *   Authorization: Bearer <supabase_access_token>
 *
 * Response 200:
 *   {
 *     "token": "<header>.<payload>.<signature>",
 *     "tier": "pro" | "free",
 *     "is_lifetime": false,
 *     "expires_at": "<ISO8601>",
 *     "display_id": "VV-XXXXXXXX"
 *   }
 *
 * Security:
 *   - Supabase JWT is verified server-side.
 *   - Entitlement is queried from the authoritative database.
 *   - Private signing key never leaves the server.
 *   - Token TTL is set via ENTITLEMENT_TOKEN_TTL_SECONDS env var.
 */

'use strict';

const { validateEnv, env } = require('../../lib/env');
const { verifyUserToken, rpc, query } = require('../../lib/supabase');
const { signEntitlementToken } = require('../../lib/token');
const { json, handleMethodAndCors, extractBearerToken, withErrorHandling } = require('../../lib/http');

validateEnv();

module.exports = withErrorHandling(async (req, res) => {
  if (handleMethodAndCors(req, res, ['GET'])) return;

  // 1. Authenticate caller
  const accessToken = extractBearerToken(req);
  if (!accessToken) {
    return json(res, 401, { error: 'Authorization header required' });
  }

  const user = await verifyUserToken(accessToken);

  // 2. Ensure profile exists (safe, idempotent — handles first sign-in)
  await rpc('ensure_profile', { p_user_id: user.id });

  // 3. Fetch user's display_id from profiles
  const profiles = await query('profiles', 'GET', `id=eq.${user.id}&select=display_id,is_confirmed`);
  const profile = profiles?.[0];

  if (!profile) {
    return json(res, 404, { error: 'Profile not found — please sign in again' });
  }

  // 4. Resolve effective entitlement (lifetime > subscription > free)
  const entitlementRows = await rpc('get_effective_entitlement', { p_user_id: user.id });
  const entitlement = Array.isArray(entitlementRows) ? entitlementRows[0] : entitlementRows;

  const tier = entitlement?.tier || 'free';
  const isLifetime = entitlement?.is_lifetime ?? false;
  const validUntil = entitlement?.valid_until || null;

  // 5. Sign the entitlement token
  const token = signEntitlementToken({
    userId: user.id,
    displayId: profile.display_id,
    tier,
    isLifetime,
    validUntil,
  });

  const ttlSeconds = parseInt(env('ENTITLEMENT_TOKEN_TTL_SECONDS'), 10);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  // 6. Update last_verified_at on the active entitlement (non-critical — fire and forget)
  if (tier === 'pro' && entitlement?.source_id) {
    query('entitlements', 'PATCH',
      `user_id=eq.${user.id}&status=eq.active`,
      { last_verified_at: new Date().toISOString() }
    ).catch(e => console.warn('[Token] Failed to update last_verified_at:', e.message));
  }

  return json(res, 200, {
    token,
    tier,
    is_lifetime: isLifetime,
    valid_until: validUntil,
    expires_at: expiresAt,
    display_id: profile.display_id,
  });
});
