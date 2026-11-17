/**
 * GET /api/config
 *
 * Returns public-safe frontend configuration values required by the
 * browser-side Supabase and Paddle SDKs.
 *
 * NEVER returns:
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - PADDLE_API_KEY
 *   - PADDLE_WEBHOOK_SECRET_KEY
 *   - ED25519_PRIVATE_KEY_PEM
 *
 * Response 200:
 *   {
 *     "supabaseUrl":       "https://...",
 *     "supabaseAnonKey":   "eyJ...",
 *     "paddleClientToken": "test_...",
 *     "paddleEnvironment": "sandbox"
 *   }
 */

'use strict';

const PUBLIC_ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'PADDLE_CLIENT_TOKEN',
  'PADDLE_ENVIRONMENT',
];

module.exports = (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  // Validate that all required public vars are present
  const missing = PUBLIC_ENV_KEYS.filter(k => !process.env[k]?.trim());
  if (missing.length > 0) {
    console.error(`[Config] Missing public environment variables: ${missing.join(', ')}`);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Server configuration incomplete' }));
  }

  // Cache for 5 minutes — these values rarely change
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  return res.end(JSON.stringify({
    supabaseUrl:       process.env.SUPABASE_URL.trim(),
    supabaseAnonKey:   process.env.SUPABASE_ANON_KEY.trim(),
    paddleClientToken: process.env.PADDLE_CLIENT_TOKEN.trim(),
    paddleEnvironment: process.env.PADDLE_ENVIRONMENT.trim().toLowerCase(),
  }));
};
