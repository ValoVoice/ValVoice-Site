/**
 * ValVoice Frontend — Paddle Sandbox Checkout Module
 *
 * Connects pricing buttons to the deployed backend and launches
 * Paddle Sandbox overlay checkout.
 *
 * Requires:
 *   - valvoice-auth.js loaded first (window.ValVoiceAuth)
 *   - Paddle.js v2: <script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
 *
 * Exposes window.ValVoiceCheckout
 */

'use strict';

(function () {
  let _paddleInitialized = false;
  let _initPromise = null;
  let _checkoutInProgress = false;

  /** Map frontend billing period names to backend tier names */
  const TIER_MAP = {
    monthly:  'monthly',
    yearly:   'annual',
    annual:   'annual',
    lifetime: 'lifetime',
  };

  // ─── Initialisation ──────────────────────────────────────────────────

  function init() {
    if (_initPromise) return _initPromise;
    _initPromise = _doInit();
    return _initPromise;
  }

  async function _doInit() {
    try {
      // Wait for auth module to initialise (loads /api/config)
      const config = await ValVoiceAuth.init();

      if (!window.Paddle) {
        console.warn('[ValVoiceCheckout] Paddle.js not loaded');
        return config;
      }

      // Fail closed: refuse to initialise if environment is missing or not sandbox
      if (!config.paddleEnvironment || config.paddleEnvironment !== 'sandbox') {
        throw new Error('Paddle environment is not sandbox — checkout disabled for safety');
      }

      // Set environment BEFORE Initialize() per Paddle.js global-script docs
      // https://developer.paddle.com/paddle-js/methods/paddle-environment-set/
      Paddle.Environment.set('sandbox');

      // Initialize Paddle.js with sandbox client-side token
      Paddle.Initialize({
        token: config.paddleClientToken,
        eventCallback: _handlePaddleEvent,
      });

      _paddleInitialized = true;
      console.log('[ValVoiceCheckout] Paddle.js initialized (sandbox)');
      return config;
    } catch (err) {
      console.error('[ValVoiceCheckout] Init failed:', err.message);
      _initPromise = null;
      throw err;
    }
  }

  // ─── Checkout Flow ───────────────────────────────────────────────────

  /**
   * Starts the checkout flow for a given tier.
   * @param {string} tier — 'monthly', 'yearly', or 'lifetime'
   */
  async function startCheckout(tier) {
    // Duplicate-click protection
    if (_checkoutInProgress) return;
    _checkoutInProgress = true;

    // Find the button that triggered this to show loading state
    const btnId = tier === 'lifetime' ? 'lifetime-cta' : 'pro-cta';
    const btn = document.getElementById(btnId);
    const originalText = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Processing...';
    }

    try {
      // 1. Map frontend tier to backend tier
      const backendTier = TIER_MAP[tier];
      if (!backendTier) {
        throw new Error(`Invalid tier: ${tier}`);
      }

      // 2. Ensure user is authenticated
      await init();
      if (!ValVoiceAuth.isAuthenticated()) {
        // Show auth modal and retry after successful authentication
        _checkoutInProgress = false;
        if (btn) { btn.disabled = false; btn.textContent = originalText; }
        ValVoiceAuth.showModal(() => {
          // Retry checkout after successful auth
          startCheckout(tier);
        });
        return;
      }

      // 3. Get access token
      const accessToken = ValVoiceAuth.getAccessToken();
      if (!accessToken) {
        throw new Error('No valid session. Please sign in again.');
      }

      // 4. Call backend to create Paddle transaction
      const response = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          tier: backendTier,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          // Session expired — show auth modal
          _checkoutInProgress = false;
          if (btn) { btn.disabled = false; btn.textContent = originalText; }
          ValVoiceAuth.showModal(() => { startCheckout(tier); });
          return;
        }
        throw new Error(data.error || `Checkout failed (${response.status})`);
      }

      // 5. Open Paddle checkout overlay
      if (_paddleInitialized && data.transaction_id) {
        Paddle.Checkout.open({
          transactionId: data.transaction_id,
        });
      } else if (data.checkout_url) {
        // Fallback: redirect to Paddle checkout URL
        window.location.href = data.checkout_url;
      } else {
        throw new Error('No checkout URL or transaction ID returned');
      }

    } catch (err) {
      console.error('[ValVoiceCheckout] Error:', err.message);
      _showCheckoutError(err.message);
    } finally {
      _checkoutInProgress = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
  }

  // ─── Paddle Event Handling ───────────────────────────────────────────

  function _handlePaddleEvent(event) {
    if (!event?.name) return;

    switch (event.name) {
      case 'checkout.completed':
        console.log('[ValVoiceCheckout] Checkout completed');
        // Redirect to success page — Paddle webhook is the payment authority
        window.location.href = '/checkout/success';
        break;

      case 'checkout.closed':
        console.log('[ValVoiceCheckout] Checkout closed by user');
        break;

      case 'checkout.error':
        console.error('[ValVoiceCheckout] Checkout error:', event.data);
        _showCheckoutError('Payment processing error. Please try again.');
        break;
    }
  }

  // ─── Error Display ───────────────────────────────────────────────────

  function _showCheckoutError(message) {
    // Reuse the email toast pattern from script.js
    let toast = document.getElementById('checkout-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'checkout-toast';
      toast.className = 'email-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = '';
    var icon = document.createElement('i');
    icon.className = 'fas fa-exclamation-circle';
    icon.style.color = '#ff4655';
    icon.style.marginRight = '8px';
    var span = document.createElement('span');
    span.textContent = message;
    toast.appendChild(icon);
    toast.appendChild(span);
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.classList.remove('show'); }, 5000);
  }

  // ─── Auto-Init on DOM Ready ─────────────────────────────────────────

  function _onReady() {
    init().catch(() => {}); // silent — errors logged internally
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _onReady);
  } else {
    _onReady();
  }

  // ─── Public API ─────────────────────────────────────────────────────

  window.ValVoiceCheckout = {
    init,
    startCheckout,
  };
})();
