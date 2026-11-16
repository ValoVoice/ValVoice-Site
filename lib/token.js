/**
 * ValVoice Backend — Ed25519 Entitlement Token Signing & Verification
 *
 * Signs compact JWT-style entitlement tokens with an Ed25519 private key
 * held exclusively on the Vercel backend. The corresponding public key is
 * bundled in the ValVoice desktop application for offline signature
 * verification without any network dependency.
 *
 * Token Structure (3-part dot-separated base64url):
 *   header.payload.signature
 *
 * Header:  { "alg": "EdDSA", "typ": "VV1" }
 * Payload: See TokenClaims typedef below.
 * Sig:     Ed25519 signature over "header.payload" bytes.
 *
 * We implement this without an external JWT library to:
 *   1. Eliminate npm dependency chain for a security-critical component.
 *   2. Keep the format minimal and verifiable by Java's standard crypto.
 *   3. Avoid incompatibilities between JWT library alg names and Java's
 *      "EdDSA" / "Ed25519" algorithm identifiers.
 */

'use strict';

const crypto = require('crypto');
const { env } = require('./env');

/**
 * @typedef {object} TokenClaims
 * @property {string}  sub           Supabase user UUID (auth.users.id).
 * @property {string}  display_id    Public display ID (e.g. 'VV-8A3F9B2C').
 * @property {string}  tier          'pro' | 'free'.
 * @property {string[]} features     Unlocked feature flags.
 * @property {boolean} is_lifetime   True for lifetime purchases.
 * @property {string}  iss           Issuer URL.
 * @property {number}  iat           Issued-at (Unix seconds).
 * @property {number}  exp           Expiration (Unix seconds).
 */

/** Issuer identifier — must match what the desktop verifier expects. */
const TOKEN_ISSUER = 'https://valvoice.vercel.app';

/** Features granted to Pro users. */
const PRO_FEATURES = ['all_agent_voices', 'unlimited_quota', 'priority_tts'];

/** Features granted to Free users. */
const FREE_FEATURES = ['basic_sapi_voices', 'limited_quota'];

/**
 * Encodes a buffer or string as URL-safe base64 (no padding).
 * @param {Buffer|string} data
 * @returns {string}
 */
function base64url(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(data), 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decodes a base64url string to a Buffer.
 * @param {string} str
 * @returns {Buffer}
 */
function base64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(pad), 'base64');
}

/** Fixed base64url-encoded header (pre-computed for performance). */
const HEADER_B64 = base64url(Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'VV1' }), 'utf8'));

/**
 * Signs and returns an entitlement token for the given user.
 *
 * @param {object} opts
 * @param {string}   opts.userId       Supabase user UUID.
 * @param {string}   opts.displayId    Public display ID (VV-XXXXXXXX).
 * @param {'pro'|'free'} opts.tier     Entitlement tier.
 * @param {boolean}  opts.isLifetime   True for lifetime entitlements.
 * @param {string|null} opts.validUntil  ISO8601 string or null (null = lifetime).
 * @returns {string}  Signed token string (header.payload.signature).
 */
function signEntitlementToken({ userId, displayId, tier, isLifetime, validUntil }) {
  const privateKeyPem = env('ED25519_PRIVATE_KEY_PEM');
  const ttlSeconds = parseInt(env('ENTITLEMENT_TOKEN_TTL_SECONDS'), 10);

  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;

  /** @type {TokenClaims} */
  const claims = {
    sub: userId,
    display_id: displayId,
    tier,
    features: tier === 'pro' ? PRO_FEATURES : FREE_FEATURES,
    is_lifetime: Boolean(isLifetime),
    valid_until: validUntil || null,
    iss: TOKEN_ISSUER,
    iat: now,
    exp,
  };

  const payloadB64 = base64url(Buffer.from(JSON.stringify(claims), 'utf8'));
  const signingInput = Buffer.from(`${HEADER_B64}.${payloadB64}`, 'utf8');

  let privateKey;
  try {
    privateKey = crypto.createPrivateKey(privateKeyPem);
  } catch (e) {
    throw new Error(`[Token] Failed to load Ed25519 private key: ${e.message}`);
  }

  const signature = crypto.sign(null, signingInput, privateKey);
  const signatureB64 = signature.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `${HEADER_B64}.${payloadB64}.${signatureB64}`;
}

/**
 * Verifies an entitlement token signature using the bundled public key.
 * Used in tests and the /api/entitlements/verify endpoint.
 *
 * @param {string} token  Token string to verify.
 * @returns {{ valid: boolean, claims: TokenClaims }}
 */
function verifyEntitlementToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, claims: null, reason: 'Token is null or empty' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, claims: null, reason: 'Token does not have 3 parts' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // Parse header
  let header;
  try {
    header = JSON.parse(base64urlDecode(headerB64).toString('utf8'));
  } catch {
    return { valid: false, claims: null, reason: 'Header is not valid base64url JSON' };
  }

  if (header.alg !== 'EdDSA' || header.typ !== 'VV1') {
    return { valid: false, claims: null, reason: `Unexpected header: alg=${header.alg}, typ=${header.typ}` };
  }

  // Parse claims
  let claims;
  try {
    claims = JSON.parse(base64urlDecode(payloadB64).toString('utf8'));
  } catch {
    return { valid: false, claims: null, reason: 'Payload is not valid base64url JSON' };
  }

  // Verify signature
  let publicKey;
  try {
    publicKey = crypto.createPublicKey(env('ED25519_PUBLIC_KEY_PEM'));
  } catch (e) {
    throw new Error(`[Token] Failed to load Ed25519 public key: ${e.message}`);
  }

  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
  let sigBuffer;
  try {
    sigBuffer = base64urlDecode(signatureB64);
  } catch {
    return { valid: false, claims, reason: 'Signature is not valid base64url' };
  }

  let isValid;
  try {
    isValid = crypto.verify(null, signingInput, publicKey, sigBuffer);
  } catch {
    return { valid: false, claims, reason: 'Signature verification threw an error' };
  }

  if (!isValid) {
    return { valid: false, claims, reason: 'Signature does not match' };
  }

  // Expiry check
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp && claims.exp < now) {
    return { valid: false, claims, reason: `Token expired at ${new Date(claims.exp * 1000).toISOString()}` };
  }

  // Issuer check
  if (claims.iss !== TOKEN_ISSUER) {
    return { valid: false, claims, reason: `Unexpected issuer: ${claims.iss}` };
  }

  return { valid: true, claims };
}

module.exports = {
  signEntitlementToken,
  verifyEntitlementToken,
  base64url,
  base64urlDecode,
  PRO_FEATURES,
  FREE_FEATURES,
  TOKEN_ISSUER,
};
