/**
 * POST /api/entitlements/sync
 *
 * Force-reconciles a user's entitlement against the live Paddle API.
 * Called when:
 *   - A user clicks "Refresh License" in the desktop application.
 *   - The desktop detects a stale or corrupted local token.
 *   - Webhook delivery was lost (e.g. temporary outage on our side).
 *
 * This is a reconciliation endpoint — it fetches ground truth from Paddle,
 * updates Supabase, and returns a fresh signed token.
 *
 * Request:
 *   POST /api/entitlements/sync
 *   Authorization: Bearer <supabase_access_token>
 *
 * Response 200:
 *   { "token": "...", "tier": "pro"|"free", "synced": true }
 */

'use strict';

const { validateEnv } = require('../../lib/env');
const { verifyUserToken, rpc, query } = require('../../lib/supabase');
const { getSubscription } = require('../../lib/paddle');
const { signEntitlementToken } = require('../../lib/token');
const { json, handleMethodAndCors, extractBearerToken, withErrorHandling } = require('../../lib/http');
const { env } = require('../../lib/env');

validateEnv();

module.exports = withErrorHandling(async (req, res) => {
  if (handleMethodAndCors(req, res, ['POST'])) return;

  // 1. Authenticate caller
  const accessToken = extractBearerToken(req);
  if (!accessToken) {
    return json(res, 401, { error: 'Authorization header required' });
  }

  const user = await verifyUserToken(accessToken);

  // 2. Ensure profile exists
  await rpc('ensure_profile', { p_user_id: user.id });

  // 3. Fetch user's current subscriptions from our DB
  const subscriptions = await query('subscriptions', 'GET',
    `user_id=eq.${user.id}&status=in.(active,past_due)&select=id,status,current_period_end`
  );

  let synced = false;

  // 4. For each active subscription, verify live status against Paddle API
  for (const sub of (subscriptions || [])) {
    try {
      const liveSub = await getSubscription(sub.id);
      const liveStatus = liveSub.status;
      const livePeriodEnd = liveSub.current_billing_period?.ends_at || sub.current_period_end;

      // Sync subscription status and period
      await query('subscriptions', 'PATCH', `id=eq.${encodeURIComponent(sub.id)}`, {
        status: liveStatus,
        current_period_end: livePeriodEnd,
        last_event_occurred_at: new Date().toISOString(),
      });

      // Sync entitlement based on live status
      if (liveStatus === 'active' || liveStatus === 'past_due') {
        // Extend entitlement with live period end
        const existing = await query('entitlements', 'GET',
          `user_id=eq.${user.id}&source_id=eq.${encodeURIComponent(sub.id)}&select=id`
        );
        if (existing?.length > 0) {
          await query('entitlements', 'PATCH',
            `id=eq.${existing[0].id}`,
            {
              status: 'active',
              valid_until: livePeriodEnd,
              last_verified_at: new Date().toISOString(),
            }
          );
          synced = true;
        }
      } else if (liveStatus === 'canceled') {
        const hasTimeRemaining = livePeriodEnd && new Date(livePeriodEnd) > new Date();
        if (hasTimeRemaining) {
          // Do NOT revoke prematurely: user paid for the billing period and retains Pro access until livePeriodEnd
          console.log(`[Sync] Subscription ${sub.id} is canceled but retained until period end ${livePeriodEnd}`);
        } else {
          await query('entitlements', 'PATCH',
            `user_id=eq.${user.id}&source_id=eq.${encodeURIComponent(sub.id)}`,
            { status: 'revoked' }
          );
          synced = true;
        }
      } else if (liveStatus === 'paused') {
        await query('entitlements', 'PATCH',
          `user_id=eq.${user.id}&source_id=eq.${encodeURIComponent(sub.id)}`,
          { status: 'revoked' }
        );
        synced = true;
      }
    } catch (e) {
      console.warn(`[Sync] Failed to fetch live subscription ${sub.id} from Paddle:`, e.message);
    }
  }

  // 5. Resolve effective entitlement after sync
  const entitlementRows = await rpc('get_effective_entitlement', { p_user_id: user.id });
  const entitlement = Array.isArray(entitlementRows) ? entitlementRows[0] : entitlementRows;

  const profiles = await query('profiles', 'GET', `id=eq.${user.id}&select=display_id`);
  const displayId = profiles?.[0]?.display_id || 'VV-UNKNOWN';

  const tier = entitlement?.tier || 'free';
  const isLifetime = entitlement?.is_lifetime ?? false;
  const validUntil = entitlement?.valid_until || null;

  // 6. Issue fresh signed token
  const token = signEntitlementToken({
    userId: user.id,
    displayId,
    tier,
    isLifetime,
    validUntil,
  });

  const ttlSeconds = parseInt(env('ENTITLEMENT_TOKEN_TTL_SECONDS'), 10);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  return json(res, 200, {
    token,
    tier,
    is_lifetime: isLifetime,
    valid_until: validUntil,
    expires_at: expiresAt,
    display_id: displayId,
    synced,
  });
});
