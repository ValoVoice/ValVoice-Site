/**
 * ValVoice Backend — Supabase Service-Role Client
 *
 * Provides a database client using the service_role key exclusively on the
 * server side. Never exposed to clients or included in browser bundles.
 *
 * Uses raw HTTPS requests (no npm Supabase client needed) to minimise
 * cold-start time and dependency surface on Vercel serverless.
 */

'use strict';

const https = require('https');
const { env } = require('./env');

/**
 * Executes a SQL query via Supabase's PostgREST RPC endpoint.
 * Uses service_role key — full database access, bypasses RLS.
 *
 * @param {string} functionName  Name of the Supabase/PostgreSQL RPC function.
 * @param {object} params        Named parameters to pass.
 * @returns {Promise<any>}       Parsed JSON response body.
 */
async function rpc(functionName, params = {}) {
  return _supabaseRequest('POST', `/rest/v1/rpc/${functionName}`, params);
}

/**
 * Executes a PostgREST table query (SELECT, INSERT, UPSERT, UPDATE, DELETE).
 *
 * @param {string} table         Table name in public schema.
 * @param {string} method        HTTP method: GET, POST, PATCH, DELETE.
 * @param {string} [query]       PostgREST query string (e.g. 'id=eq.foo').
 * @param {object|null} [body]   Request body for mutations.
 * @param {string} [prefer]      Prefer header value (e.g. 'return=representation').
 * @returns {Promise<any>}
 */
async function query(table, method, queryStr = '', body = null, prefer = null) {
  const path = `/rest/v1/${table}${queryStr ? '?' + queryStr : ''}`;
  return _supabaseRequest(method, path, body, prefer);
}

/**
 * Internal HTTPS request helper.
 * @private
 */
function _supabaseRequest(method, path, body = null, prefer = null) {
  return new Promise((resolve, reject) => {
    const supabaseUrl = new URL(env('SUPABASE_URL'));
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');

    const headers = {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (prefer) headers['Prefer'] = prefer;

    const bodyStr = body !== null ? JSON.stringify(body) : null;
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const options = {
      hostname: supabaseUrl.hostname,
      port: 443,
      path,
      method,
      headers,
      timeout: 8000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(data ? JSON.parse(data) : null);
          } catch {
            resolve(data);
          }
        } else {
          let errBody;
          try { errBody = JSON.parse(data); } catch { errBody = { raw: data }; }
          const err = new Error(`[Supabase] HTTP ${res.statusCode} on ${method} ${path}`);
          err.status = res.statusCode;
          err.body = errBody;
          reject(err);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error(`[Supabase] Request timeout on ${method} ${path}`));
    });

    req.on('error', (e) => {
      reject(new Error(`[Supabase] Network error on ${method} ${path}: ${e.message}`));
    });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/**
 * Verifies a Supabase JWT (access_token) and returns the user payload.
 * Uses Supabase Auth admin endpoint — does NOT trust the token claims
 * without server-side verification.
 *
 * @param {string} accessToken  Bearer token from the client.
 * @returns {Promise<object>}   Supabase user object { id, email, ... }.
 * @throws {Error}              If token is invalid or expired.
 */
async function verifyUserToken(accessToken) {
  if (!accessToken || typeof accessToken !== 'string') {
    throw Object.assign(new Error('Missing or invalid Authorization token'), { status: 401 });
  }

  return _verifyTokenWithUserBearer(accessToken);
}

/** @private — calls /auth/v1/user with the user's own bearer token */
function _verifyTokenWithUserBearer(accessToken) {
  return new Promise((resolve, reject) => {
    const supabaseUrl = new URL(env('SUPABASE_URL'));
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');

    const options = {
      hostname: supabaseUrl.hostname,
      port: 443,
      path: '/auth/v1/user',
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
      timeout: 8000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const user = JSON.parse(data);
            if (!user || !user.id) {
              return reject(Object.assign(new Error('Invalid user object from Supabase Auth'), { status: 401 }));
            }
            resolve(user);
          } catch {
            reject(Object.assign(new Error('Failed to parse Supabase Auth response'), { status: 401 }));
          }
        } else {
          reject(Object.assign(
            new Error(`Supabase Auth returned HTTP ${res.statusCode}`),
            { status: 401 }
          ));
        }
      });
    });

    req.on('timeout', () => req.destroy(new Error('Supabase Auth timeout')));
    req.on('error', e => reject(Object.assign(new Error(`Supabase Auth network error: ${e.message}`), { status: 503 })));
    req.end();
  });
}

module.exports = { rpc, query, verifyUserToken };
