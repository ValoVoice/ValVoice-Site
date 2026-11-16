/**
 * POST /api/webhooks/paddle
 *
 * Receives and processes Paddle Sandbox webhook events.
 *
 * Security Architecture:
 *   1. HMAC-SHA256 signature verification using raw body (never parsed body).
 *   2. Timing-safe comparison (crypto.timingSafeEqual).
 *   3. 300-second timestamp tolerance (serverless cold-start safe).
 *   4. HTTP 200 is returned immediately after signature verification.
 *   5. All entitlement mutations happen asynchronously via processEventAsync()
 *      to meet Paddle's 5-second response SLA under all conditions.
 *
 * Idempotency Architecture:
 *   - Atomic insert via public.claim_webhook_event() DB function.
 *   - Three-state machine: 'processing' → 'processed' | 'failed'.
 *   - Failed events can be re-processed on subsequent Paddle retries.
 *   - Out-of-order protection via occurred_at comparison on subscriptions.
 *
 * Supported Events:
 *   subscription.activated, subscription.updated, subscription.canceled,
 *   subscription.past_due, subscription.paused, subscription.resumed,
 *   transaction.completed (lifetime), transaction.refunded, adjustment.created
 */

'use strict';

const { validateEnv } = require('../../lib/env');
const { rpc, query } = require('../../lib/supabase');
const { verifyPaddleWebhook, extractCustomUserId, extractBillingEmail, isStaleEvent, evaluateAdjustment } = require('../../lib/webhook');
const { readRawBody, json, withErrorHandling } = require('../../lib/http');

validateEnv();

/** Set of Paddle price IDs that represent lifetime one-time purchases. */
function getLifetimePriceId() {
  return process.env.PADDLE_PRICE_LIFETIME?.trim() || null;
}

module.exports = withErrorHandling(async (req, res) => {
  if (req.method !== 'POST') {
    // Paddle only sends POST — return 405 without further processing
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  // 1. Read raw body BEFORE any parsing (HMAC requires original bytes)
  const rawBody = await readRawBody(req, 2_097_152); // 2 MiB max

  // 2. Verify Paddle HMAC signature — throws 401/400/403 on failure
  const { event, eventId, occurredAt } = verifyPaddleWebhook(
    rawBody,
    req.headers['paddle-signature']
  );

  // 3. Process the event durably BEFORE responding.
  // In serverless environments (Vercel / AWS Lambda), responding with HTTP 200 before
  // background work completes risks container freezing or immediate termination,
  // leading to dropped events and unapplied purchases.
  // Synchronous durable execution guarantees:
  //   a) The event is durably recorded and dispatched in Supabase before 200 is returned.
  //   b) Duplicate deliveries are safely skipped via atomic DB claiming.
  //   c) Any transient failure (DB/network) throws an error, resulting in HTTP 500,
  //      which tells Paddle's webhook delivery system to retry with exponential backoff.
  const outcome = await processEvent(event, eventId, occurredAt);

  json(res, 200, {
    received: true,
    event_id: eventId,
    status: outcome.status,
  });
});

/**
 * Durable event processor.
 *
 * @param {object} event       Verified Paddle event object.
 * @param {string} eventId     Paddle event_id.
 * @param {string} occurredAt  ISO8601 Paddle occurred_at timestamp.
 * @returns {Promise<{ status: string }>}
 */
async function processEvent(event, eventId, occurredAt) {
  const eventType = event.event_type;

  // 1. Atomic idempotency claim — returns 'processing' or null
  const claimStatus = await rpc('claim_webhook_event', {
    p_event_id: eventId,
    p_event_type: eventType,
    p_payload: event,
    p_occurred_at: occurredAt,
  });

  if (!claimStatus) {
    // Event already processing or already processed — safe to skip
    console.log(`[Webhook] Skipping already-claimed event ${eventId} (type=${eventType})`);
    return { status: 'skipped_duplicate' };
  }

  console.log(`[Webhook] Processing event ${eventId} (type=${eventType})`);

  try {
    await dispatchEvent(event, eventType, occurredAt);
    // Mark as processed
    await query('webhook_events', 'PATCH', `event_id=eq.${encodeURIComponent(eventId)}`, {
      status: 'processed',
      processed_at: new Date().toISOString(),
    });
    console.log(`[Webhook] Successfully processed event ${eventId}`);
    return { status: 'processed' };
  } catch (err) {
    // Mark as failed — allows retry on next Paddle delivery
    console.error(`[Webhook] Event processing failed for ${eventId}:`, err.message);
    try {
      await query('webhook_events', 'PATCH', `event_id=eq.${encodeURIComponent(eventId)}`, {
        status: 'failed',
        error_message: err.message.substring(0, 500),
      });
    } catch (patchErr) {
      console.error(`[Webhook] Failed to mark event ${eventId} as failed:`, patchErr.message);
    }
    // Re-throw error so withErrorHandling returns HTTP 500 to Paddle, triggering retry!
    throw err;
  }
}

/**
 * Routes a verified Paddle event to its handler.
 * @param {object} event
 * @param {string} eventType
 * @param {string} occurredAt
 */
async function dispatchEvent(event, eventType, occurredAt) {
  switch (eventType) {
    case 'subscription.activated':
    case 'subscription.created':
      return handleSubscriptionActivated(event, occurredAt);

    case 'subscription.updated':
      return handleSubscriptionUpdated(event, occurredAt);

    case 'subscription.canceled':
      return handleSubscriptionCanceled(event, occurredAt);

    case 'subscription.past_due':
      return handleSubscriptionPastDue(event, occurredAt);

    case 'subscription.paused':
      return handleSubscriptionPaused(event, occurredAt);

    case 'subscription.resumed':
      return handleSubscriptionActivated(event, occurredAt); // Same logic as activated

    case 'transaction.completed':
      return handleTransactionCompleted(event, occurredAt);

    case 'transaction.refunded':
    case 'adjustment.created':
      return handleRefundOrAdjustment(event, occurredAt);

    default:
      // Log unknown events as ignored — do not fail them
      console.log(`[Webhook] Ignoring unknown event type: ${eventType}`);
      await query('webhook_events', 'PATCH',
        `event_id=eq.${encodeURIComponent(event.event_id)}`,
        { status: 'ignored' }
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleSubscriptionActivated(event, occurredAt) {
  const sub = event.data;
  const userId = extractCustomUserId(event);
  const subId = sub.id; // sub_...

  if (!subId) throw new Error('subscription.activated: missing subscription ID');

  // Paddle subscription status guard: only grant entitlement when the
  // subscription has actually reached an active/confirmed payment state.
  // subscription.created may fire with status 'trialing' or 'past_due'
  // before payment is confirmed. We must NOT grant Pro in those cases.
  const paddleStatus = (sub.status || '').toLowerCase();
  const ENTITLEMENT_GRANTING_STATUSES = new Set(['active']);

  // Extract billing period details from Paddle's current_billing_period
  const periodStart = sub.current_billing_period?.starts_at || new Date().toISOString();
  const periodEnd = sub.current_billing_period?.ends_at || null;

  if (!periodEnd) throw new Error('subscription.activated: missing current_billing_period.ends_at');

  const priceId = sub.items?.[0]?.price?.id || sub.items?.[0]?.price_id || null;
  const productId = sub.items?.[0]?.price?.product_id || null;
  const billingCycle = detectBillingCycle(sub.items?.[0]?.price);

  // Event ordering check: reject stale events
  const existing = await query('subscriptions', 'GET', `id=eq.${encodeURIComponent(subId)}&select=last_event_occurred_at`);
  if (existing?.length > 0) {
    const storedOccurredAt = existing[0]?.last_event_occurred_at;
    if (storedOccurredAt && new Date(occurredAt) <= new Date(storedOccurredAt)) {
      console.log(`[Webhook] Stale subscription.activated for ${subId} — ignoring (event=${occurredAt}, stored=${storedOccurredAt})`);
      return;
    }
  }

  // Record the Paddle-reported status, not a hardcoded 'active'.
  // This ensures subscription.created with status='trialing' is stored accurately.
  const recordedStatus = ENTITLEMENT_GRANTING_STATUSES.has(paddleStatus) ? 'active' : paddleStatus || 'active';

  // Upsert subscription record
  await query('subscriptions', 'POST', '', {
    id: subId,
    user_id: userId || null,
    customer_id: sub.customer_id,
    status: recordedStatus,
    plan_tier: 'pro',
    billing_cycle: billingCycle,
    price_id: priceId,
    product_id: productId,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: false,
    last_event_occurred_at: occurredAt,
    management_urls: sub.management_urls || null,
  }, 'resolution=merge-duplicates');

  // Grant or extend entitlement ONLY if user is linked AND Paddle confirms active status.
  // subscription.created with status='trialing' records the subscription but does NOT grant Pro.
  if (userId && ENTITLEMENT_GRANTING_STATUSES.has(paddleStatus)) {
    await upsertSubscriptionEntitlement(userId, subId, periodEnd, false);
    console.log(`[Webhook] Subscription ${subId} (status=${paddleStatus}) — entitlement granted for user ${userId}`);
  } else if (userId) {
    console.log(`[Webhook] Subscription ${subId} (status=${paddleStatus}) — recorded but entitlement NOT granted (awaiting active status)`);
  }
}

async function handleSubscriptionUpdated(event, occurredAt) {
  const sub = event.data;
  const subId = sub.id;

  if (!subId) throw new Error('subscription.updated: missing subscription ID');

  // Event ordering check
  const existing = await query('subscriptions', 'GET', `id=eq.${encodeURIComponent(subId)}&select=last_event_occurred_at,user_id`);
  if (existing?.length > 0) {
    const storedOccurredAt = existing[0]?.last_event_occurred_at;
    if (storedOccurredAt && new Date(occurredAt) <= new Date(storedOccurredAt)) {
      console.log(`[Webhook] Stale subscription.updated for ${subId} — ignoring`);
      return;
    }
  }

  const userId = existing?.[0]?.user_id || extractCustomUserId(event) || null;
  const periodEnd = sub.current_billing_period?.ends_at || null;
  const newStatus = sub.status || 'active';
  const cancelAtPeriodEnd = sub.cancel_at_period_end ?? false;

  await query('subscriptions', 'PATCH', `id=eq.${encodeURIComponent(subId)}`, {
    status: newStatus,
    current_period_start: sub.current_billing_period?.starts_at,
    current_period_end: periodEnd,
    cancel_at_period_end: cancelAtPeriodEnd,
    last_event_occurred_at: occurredAt,
    management_urls: sub.management_urls || null,
  });

  // Lifecycle state updates:
  if (newStatus === 'paused') {
    if (userId) await revokeEntitlementBySource(userId, subId);
    console.log(`[Webhook] Subscription ${subId} updated to paused — entitlement revoked for user ${userId}`);
  } else if (newStatus === 'canceled') {
    const isImmediate = !periodEnd || new Date(periodEnd) <= new Date(occurredAt);
    if (userId && isImmediate) {
      await revokeEntitlementBySource(userId, subId);
      console.log(`[Webhook] Subscription ${subId} updated to canceled immediately — entitlement revoked for user ${userId}`);
    }
  } else if (userId && periodEnd && newStatus === 'active') {
    // Extend or reinstate entitlement on renewal/resumption
    await upsertSubscriptionEntitlement(userId, subId, periodEnd, false);
  }
}

async function handleSubscriptionCanceled(event, occurredAt) {
  const sub = event.data;
  const subId = sub.id;

  if (!subId) throw new Error('subscription.canceled: missing subscription ID');

  // Check ordering
  const existing = await query('subscriptions', 'GET', `id=eq.${encodeURIComponent(subId)}&select=last_event_occurred_at,user_id,current_period_end`);
  if (existing?.length > 0) {
    const storedOccurredAt = existing[0]?.last_event_occurred_at;
    if (storedOccurredAt && new Date(occurredAt) <= new Date(storedOccurredAt)) {
      console.log(`[Webhook] Stale subscription.canceled for ${subId} — ignoring`);
      return;
    }
  }

  const userId = existing?.[0]?.user_id || null;
  const currentPeriodEnd = existing?.[0]?.current_period_end || null;

  await query('subscriptions', 'PATCH', `id=eq.${encodeURIComponent(subId)}`, {
    status: 'canceled',
    cancel_at_period_end: true,
    canceled_at: occurredAt,
    last_event_occurred_at: occurredAt,
  });

  const isImmediate = !currentPeriodEnd || new Date(currentPeriodEnd) <= new Date(occurredAt);
  if (userId && isImmediate) {
    await revokeEntitlementBySource(userId, subId);
    console.log(`[Webhook] Subscription ${subId} canceled immediately — entitlement revoked for user ${userId}`);
  } else if (userId) {
    console.log(`[Webhook] Subscription ${subId} canceled — user ${userId} retains access until ${currentPeriodEnd}`);
  }
}

async function handleSubscriptionPastDue(event, occurredAt) {
  const sub = event.data;
  const subId = sub.id;

  if (!subId) throw new Error('subscription.past_due: missing subscription ID');

  const existing = await query('subscriptions', 'GET', `id=eq.${encodeURIComponent(subId)}&select=last_event_occurred_at`);
  if (existing?.length > 0) {
    const storedOccurredAt = existing[0]?.last_event_occurred_at;
    if (isStaleEvent(occurredAt, storedOccurredAt)) {
      console.log(`[Webhook] Stale subscription.past_due for ${subId} — ignoring`);
      return;
    }
  }

  await query('subscriptions', 'PATCH', `id=eq.${encodeURIComponent(subId)}`, {
    status: 'past_due',
    last_event_occurred_at: occurredAt,
  });
  // Retain active entitlement during grace period — do not revoke yet
  console.log(`[Webhook] Subscription ${subId} is past_due — retaining entitlement during grace period`);
}

async function handleSubscriptionPaused(event, occurredAt) {
  const sub = event.data;
  const subId = sub.id;

  if (!subId) throw new Error('subscription.paused: missing subscription ID');

  const existing = await query('subscriptions', 'GET', `id=eq.${encodeURIComponent(subId)}&select=last_event_occurred_at,user_id`);
  if (existing?.length > 0) {
    const storedOccurredAt = existing[0]?.last_event_occurred_at;
    if (isStaleEvent(occurredAt, storedOccurredAt)) {
      console.log(`[Webhook] Stale subscription.paused for ${subId} — ignoring`);
      return;
    }
  }

  const userId = existing?.[0]?.user_id || null;

  await query('subscriptions', 'PATCH', `id=eq.${encodeURIComponent(subId)}`, {
    status: 'paused',
    last_event_occurred_at: occurredAt,
  });

  // Paused subscription = access revoked
  if (userId) {
    await revokeEntitlementBySource(userId, subId);
    console.log(`[Webhook] Subscription ${subId} paused — entitlement revoked for user ${userId}`);
  }
}

async function handleTransactionCompleted(event, occurredAt) {
  const txn = event.data;
  const txnId = txn.id; // txn_...

  if (!txnId) throw new Error('transaction.completed: missing transaction ID');

  const userId = extractCustomUserId(event);
  const billingEmail = extractBillingEmail(event);
  const priceId = txn.items?.[0]?.price?.id || txn.items?.[0]?.price_id || null;
  const productId = txn.items?.[0]?.price?.product_id || null;
  const isLifetime = priceId === getLifetimePriceId() && priceId !== null;

  // Amount: Paddle returns amount in lowest currency unit
  const details = txn.details;
  const totalAmount = details?.totals?.total || 0;
  const currency = details?.totals?.currency_code || txn.currency_code || 'USD';

  // Upsert purchase record
  await query('purchases', 'POST', '', {
    id: txnId,
    user_id: userId || null,
    customer_id: txn.customer_id,
    customer_email: billingEmail,
    subscription_id: txn.subscription_id || null,
    amount_cents: parseInt(totalAmount, 10),
    currency,
    status: 'completed',
    product_id: productId,
    price_id: priceId,
    is_lifetime: isLifetime,
    invoice_number: txn.invoice_number || null,
    receipt_url: txn.receipt_url || null,
  }, 'resolution=merge-duplicates');

  // Grant lifetime entitlement if user is linked and this is a lifetime purchase
  if (userId && isLifetime) {
    await upsertLifetimeEntitlement(userId, txnId);
    console.log(`[Webhook] Lifetime entitlement granted to user ${userId} via transaction ${txnId}`);
  } else if (!userId) {
    console.log(`[Webhook] Transaction ${txnId} recorded without user link (email: ${billingEmail}) — awaiting claim`);
  }
}

async function handleRefundOrAdjustment(event, occurredAt) {
  const data = event.data;
  const eventType = event.event_type;

  // For adjustment.created: data.transaction_id contains the original txn
  // For transaction.refunded: data.id IS the transaction
  const txnId = data.transaction_id || data.id;

  if (!txnId) {
    console.warn(`[Webhook] ${eventType}: could not determine transaction ID`);
    return;
  }

  // Evaluate adjustment under strict business rules
  const evaluation = evaluateAdjustment(event);
  console.log(`[Webhook] Evaluated ${eventType} for txn=${txnId}: reason=${evaluation.reason}, shouldRevoke=${evaluation.shouldRevoke}, isActionable=${evaluation.isActionable}`);

  if (!evaluation.isActionable) {
    return;
  }

  if (evaluation.purchaseStatus) {
    await query('purchases', 'PATCH', `id=eq.${encodeURIComponent(txnId)}`, {
      status: evaluation.purchaseStatus,
    });
  }

  if (evaluation.shouldRevoke) {
    const purchases = await query('purchases', 'GET', `id=eq.${encodeURIComponent(txnId)}&select=user_id,subscription_id`);
    const userId = purchases?.[0]?.user_id || null;
    const subId = purchases?.[0]?.subscription_id || null;

    if (userId) {
      await revokeEntitlementBySource(userId, txnId);
      if (subId) await revokeEntitlementBySource(userId, subId);
      console.log(`[Webhook] Entitlement revoked for user ${userId} (txn=${txnId}, reason=${evaluation.reason})`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entitlement Mutation Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function upsertSubscriptionEntitlement(userId, subId, validUntil, isLifetime) {
  // Find existing subscription entitlement for this user
  const existing = await query('entitlements', 'GET',
    `user_id=eq.${userId}&source_type=eq.subscription&source_id=eq.${encodeURIComponent(subId)}&select=id`
  );

  if (existing?.length > 0) {
    // Update existing
    await query('entitlements', 'PATCH',
      `id=eq.${existing[0].id}`,
      {
        status: 'active',
        valid_until: validUntil,
        last_verified_at: new Date().toISOString(),
      }
    );
  } else {
    // Insert new
    await query('entitlements', 'POST', '', {
      user_id: userId,
      tier: 'pro',
      source_type: 'subscription',
      source_id: subId,
      status: 'active',
      is_lifetime: false,
      valid_from: new Date().toISOString(),
      valid_until: validUntil,
      last_verified_at: new Date().toISOString(),
    }, 'return=minimal');
  }
}

async function upsertLifetimeEntitlement(userId, purchaseId) {
  const existing = await query('entitlements', 'GET',
    `user_id=eq.${userId}&source_type=eq.lifetime&source_id=eq.${encodeURIComponent(purchaseId)}&select=id`
  );

  if (existing?.length > 0) {
    await query('entitlements', 'PATCH',
      `id=eq.${existing[0].id}`,
      {
        status: 'active',
        is_lifetime: true,
        valid_until: null,
        last_verified_at: new Date().toISOString(),
      }
    );
  } else {
    await query('entitlements', 'POST', '', {
      user_id: userId,
      tier: 'pro',
      source_type: 'lifetime',
      source_id: purchaseId,
      status: 'active',
      is_lifetime: true,
      valid_from: new Date().toISOString(),
      valid_until: null,
      last_verified_at: new Date().toISOString(),
    }, 'return=minimal');
  }
}

async function revokeEntitlementBySource(userId, sourceId) {
  await query('entitlements', 'PATCH',
    `user_id=eq.${userId}&source_id=eq.${encodeURIComponent(sourceId)}`,
    { status: 'revoked' }
  );
}

/**
 * Detects billing cycle from a Paddle price object.
 * @param {object|null} price  Paddle price item.
 * @returns {'monthly'|'annual'|'one_time'}
 */
function detectBillingCycle(price) {
  if (!price) return 'monthly';
  const interval = price.billing_cycle?.interval || price.trial_period?.interval;
  if (!interval) return 'one_time';
  if (interval === 'year') return 'annual';
  return 'monthly';
}
