/**
 * ValVoice Backend — HTTP Response Helpers
 *
 * Shared utilities for Vercel serverless functions:
 * standardised JSON responses, CORS handling, method guards,
 * and authenticated request parsing.
 */

'use strict';

/** Allowed origins for CORS pre-flight. Add localhost for development. */
const ALLOWED_ORIGINS = [
  'https://valvoice.app',
  'https://valvoice.vercel.app',
];

/**
 * Sends a JSON response via Vercel's Node.js http.ServerResponse API.
 *
 * @param {import('http').ServerResponse} res
 * @param {number} status    HTTP status code.
 * @param {object} body      Response body (will be JSON-serialised).
 */
function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.statusCode = status;
  res.end(payload);
}

/**
 * Sets permissive CORS headers for desktop app API calls.
 * The desktop Java app does not send an Origin header (not a browser),
 * so we allow all origins for internal API routes. The webhook endpoint
 * must NOT use CORS — Paddle sends direct server-to-server requests.
 *
 * @param {import('http').ServerResponse} res
 */
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/**
 * Handles CORS pre-flight and method enforcement.
 * Returns true if the request was handled (pre-flight or bad method).
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {string[]} allowedMethods  e.g. ['POST']
 * @returns {boolean} True if the caller should return immediately.
 */
function handleMethodAndCors(req, res, allowedMethods) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }

  if (!allowedMethods.includes(req.method)) {
    json(res, 405, {
      error: 'Method not allowed',
      allowed: allowedMethods,
    });
    return true;
  }

  return false;
}

/**
 * Extracts the Bearer token from the Authorization header.
 *
 * @param {import('http').IncomingMessage} req
 * @returns {string|null}
 */
function extractBearerToken(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Reads the raw request body as a UTF-8 string.
 * IMPORTANT: For webhook endpoints, body MUST be read raw (before any JSON.parse)
 * to preserve the exact bytes used in HMAC signature computation.
 *
 * @param {import('http').IncomingMessage} req
 * @param {number} [maxBytes=1_048_576]  Maximum body size (default 1 MiB).
 * @returns {Promise<string>}
 */
function readRawBody(req, maxBytes = 1_048_576) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        req.destroy();
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        return;
      }
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8'));
    });

    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Wraps an async handler with standardised error handling.
 * Maps errors with a .status property to the appropriate HTTP code.
 * Logs unexpected errors without leaking internal details to clients.
 *
 * @param {Function} handler  async (req, res) => void
 * @returns {Function}        Vercel-compatible handler
 */
function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      const status = (err && typeof err.status === 'number') ? err.status : 500;
      const isClientError = status >= 400 && status < 500;

      if (!isClientError) {
        // Log server errors with sanitised details (no credentials, no PII)
        console.error(`[ValVoice API] Unhandled error:`, {
          status,
          message: err.message,
          url: req.url,
          method: req.method,
        });
      }

      json(res, status, {
        error: isClientError ? err.message : 'Internal server error',
        ...(err.code ? { code: err.code } : {}),
      });
    }
  };
}

module.exports = {
  json,
  setCorsHeaders,
  handleMethodAndCors,
  extractBearerToken,
  readRawBody,
  withErrorHandling,
};
