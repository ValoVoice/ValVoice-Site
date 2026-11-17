/**
 * ValVoice Frontend — Supabase Email OTP Authentication Module
 *
 * Provides sign-in, OTP verification, session management, and logout.
 * Requires Supabase JS v2 UMD loaded on the page:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
 *
 * Exposes window.ValVoiceAuth
 */

'use strict';

(function () {
  /** @type {import('@supabase/supabase-js').SupabaseClient | null} */
  let _client = null;
  let _config = null;
  let _session = null;
  let _pendingEmail = null;
  let _initPromise = null;

  // ─── Initialisation ──────────────────────────────────────────────────

  /**
   * Fetches /api/config and initialises the Supabase client.
   * Safe to call multiple times — returns cached promise.
   */
  function init() {
    if (_initPromise) return _initPromise;
    _initPromise = _doInit();
    return _initPromise;
  }

  async function _doInit() {
    try {
      const resp = await fetch('/api/config');
      if (!resp.ok) throw new Error('Failed to fetch configuration');
      _config = await resp.json();

      if (!window.supabase?.createClient) {
        throw new Error('Supabase JS SDK not loaded');
      }

      _client = window.supabase.createClient(_config.supabaseUrl, _config.supabaseAnonKey);

      // Restore existing session
      const { data } = await _client.auth.getSession();
      _session = data?.session || null;

      // Listen for auth state changes (token refresh, sign-out, etc.)
      _client.auth.onAuthStateChange((_event, session) => {
        _session = session;
        _updateAuthUI();
      });

      _updateAuthUI();
      return _config;
    } catch (err) {
      console.error('[ValVoiceAuth] Init failed:', err.message);
      _initPromise = null; // allow retry
      throw err;
    }
  }

  // ─── OTP Sign-In ─────────────────────────────────────────────────────

  /**
   * Sends a 6-digit OTP to the given email address.
   * Handles both new signups and existing users transparently.
   */
  async function signInWithOtp(email) {
    await init();
    email = email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address');
    }

    const { error } = await _client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    if (error) throw _friendlyError(error);
    _pendingEmail = email;
  }

  /**
   * Verifies a 6-digit OTP code for the pending email.
   */
  async function verifyOtp(token) {
    await init();
    if (!_pendingEmail) throw new Error('No pending OTP verification');

    token = token.trim();
    if (!/^\d{6}$/.test(token)) {
      throw new Error('Please enter a valid 6-digit code');
    }

    const { data, error } = await _client.auth.verifyOtp({
      email: _pendingEmail,
      token,
      type: 'email',
    });

    if (error) throw _friendlyError(error);
    _session = data?.session || null;
    _pendingEmail = null;
    _updateAuthUI();
    _hideModal();
    return _session;
  }

  /**
   * Resends the OTP to the pending email.
   */
  async function resendOtp() {
    if (!_pendingEmail) throw new Error('No pending email to resend to');
    return signInWithOtp(_pendingEmail);
  }

  // ─── Session Helpers ─────────────────────────────────────────────────

  function getSession() { return _session; }

  function getAccessToken() { return _session?.access_token || null; }

  function getUser() { return _session?.user || null; }

  function isAuthenticated() { return !!_session?.access_token; }

  async function signOut() {
    if (_client) {
      await _client.auth.signOut();
    }
    _session = null;
    _updateAuthUI();
  }

  function getConfig() { return _config; }

  // ─── Error Mapping ───────────────────────────────────────────────────

  function _friendlyError(err) {
    const msg = err.message || '';
    if (msg.includes('rate') || msg.includes('429')) {
      return new Error('Too many requests. Please wait a moment and try again.');
    }
    if (msg.includes('expired') || msg.includes('invalid')) {
      return new Error('Invalid or expired code. Please check and try again.');
    }
    if (msg.includes('network') || msg.includes('fetch')) {
      return new Error('Network error. Please check your connection.');
    }
    return new Error(msg || 'Authentication error. Please try again.');
  }

  // ─── Auth Modal UI ──────────────────────────────────────────────────

  function showModal(callback) {
    _onAuthSuccess = callback || null;
    const modal = document.getElementById('vv-auth-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    _showStep('email');
    _clearError();
    document.body.style.overflow = 'hidden';

    // Focus email input
    setTimeout(() => {
      const emailInput = document.getElementById('vv-auth-email');
      if (emailInput) emailInput.focus();
    }, 100);
  }

  let _onAuthSuccess = null;

  function _hideModal() {
    const modal = document.getElementById('vv-auth-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    _setLoading(false);

    if (_onAuthSuccess && _session) {
      const cb = _onAuthSuccess;
      _onAuthSuccess = null;
      cb(_session);
    }
  }

  function _showStep(step) {
    const emailStep = document.getElementById('vv-auth-step-email');
    const otpStep = document.getElementById('vv-auth-step-otp');
    if (emailStep) emailStep.style.display = step === 'email' ? 'block' : 'none';
    if (otpStep) otpStep.style.display = step === 'otp' ? 'block' : 'none';
  }

  function _showError(msg) {
    const el = document.getElementById('vv-auth-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  function _clearError() {
    const el = document.getElementById('vv-auth-error');
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  }

  function _setLoading(on) {
    const el = document.getElementById('vv-auth-loading');
    if (el) el.style.display = on ? 'flex' : 'none';
    // Disable buttons during loading
    document.querySelectorAll('.vv-auth-btn').forEach(btn => { btn.disabled = on; });
  }

  function _updateAuthUI() {
    const indicator = document.getElementById('vv-auth-indicator');
    const emailEl = document.getElementById('vv-auth-user-email');
    if (!indicator) return;

    if (_session?.user?.email) {
      indicator.style.display = 'flex';
      if (emailEl) emailEl.textContent = _session.user.email;
    } else {
      indicator.style.display = 'none';
      if (emailEl) emailEl.textContent = '';
    }
  }

  // ─── Bind Modal Events ──────────────────────────────────────────────

  function _bindModalEvents() {
    // Close button
    const closeBtn = document.querySelector('.vv-auth-close');
    if (closeBtn) closeBtn.addEventListener('click', _hideModal);

    // Backdrop click
    const backdrop = document.querySelector('.vv-auth-backdrop');
    if (backdrop) backdrop.addEventListener('click', _hideModal);

    // Send Code button
    const sendBtn = document.getElementById('vv-auth-send-btn');
    if (sendBtn) {
      sendBtn.addEventListener('click', async () => {
        const email = document.getElementById('vv-auth-email')?.value;
        if (!email) return _showError('Please enter your email address');
        _clearError();
        _setLoading(true);
        try {
          await signInWithOtp(email);
          _setLoading(false);
          _showStep('otp');
          const display = document.getElementById('vv-auth-email-display');
          if (display) display.textContent = email;
          setTimeout(() => {
            const otpInput = document.getElementById('vv-auth-otp');
            if (otpInput) otpInput.focus();
          }, 100);
        } catch (err) {
          _setLoading(false);
          _showError(err.message);
        }
      });
    }

    // Email input Enter key
    const emailInput = document.getElementById('vv-auth-email');
    if (emailInput) {
      emailInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendBtn?.click();
        }
      });
    }

    // Verify button
    const verifyBtn = document.getElementById('vv-auth-verify-btn');
    if (verifyBtn) {
      verifyBtn.addEventListener('click', async () => {
        const code = document.getElementById('vv-auth-otp')?.value;
        if (!code) return _showError('Please enter the 6-digit code');
        _clearError();
        _setLoading(true);
        try {
          await verifyOtp(code);
          _setLoading(false);
        } catch (err) {
          _setLoading(false);
          _showError(err.message);
        }
      });
    }

    // OTP input Enter key
    const otpInput = document.getElementById('vv-auth-otp');
    if (otpInput) {
      otpInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          verifyBtn?.click();
        }
      });
    }

    // Resend button
    const resendBtn = document.getElementById('vv-auth-resend-btn');
    if (resendBtn) {
      resendBtn.addEventListener('click', async () => {
        _clearError();
        _setLoading(true);
        try {
          await resendOtp();
          _setLoading(false);
          _showError('New code sent! Check your email.');
          const errEl = document.getElementById('vv-auth-error');
          if (errEl) errEl.style.color = '#10b981';
          setTimeout(() => { _clearError(); }, 4000);
        } catch (err) {
          _setLoading(false);
          _showError(err.message);
        }
      });
    }

    // Back button (use different email)
    const backBtn = document.getElementById('vv-auth-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        _pendingEmail = null;
        _clearError();
        _showStep('email');
        const otpField = document.getElementById('vv-auth-otp');
        if (otpField) otpField.value = '';
      });
    }

    // Logout button
    const logoutBtn = document.getElementById('vv-auth-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await signOut();
      });
    }

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('vv-auth-modal');
        if (modal && modal.style.display !== 'none') _hideModal();
      }
    });
  }

  // ─── Auto-Init on DOM Ready ─────────────────────────────────────────

  function _onReady() {
    _bindModalEvents();
    init().catch(() => {}); // silent init — errors logged internally
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _onReady);
  } else {
    _onReady();
  }

  // ─── Public API ─────────────────────────────────────────────────────

  window.ValVoiceAuth = {
    init,
    signInWithOtp,
    verifyOtp,
    resendOtp,
    getSession,
    getAccessToken,
    getUser,
    isAuthenticated,
    signOut,
    showModal,
    getConfig,
  };
})();
