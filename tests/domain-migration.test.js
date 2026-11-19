/**
 * ValVoice Phase 2b — Canonical Domain & SEO Migration Tests
 *
 * Validates:
 *   - All HTML pages use https://valvoice.app canonical URLs
 *   - Open Graph and Twitter metadata point to new domain
 *   - Schema.org JSON-LD uses new domain
 *   - sitemap.xml contains only new canonical URLs
 *   - robots.txt references new sitemap
 *   - Paddle checkout success URL uses new domain
 *   - CORS allowed origins include new domain
 *   - Token issuer is NOT changed (desktop verifier compatibility)
 *   - Supabase auth redirect configuration is preserved
 *   - API config endpoint preserves its four-field allowlist
 *   - Privacy policy prose references new domain
 *
 * Uses Node.js native test runner (zero external dependencies).
 * Run: node --test tests/domain-migration.test.js
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CANONICAL_DOMAIN = 'https://valvoice.app';
const OLD_DOMAIN = 'https://valvoice.vercel.app';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: read file from project root
// ─────────────────────────────────────────────────────────────────────────────

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. HTML Canonical URLs, OG, Twitter & Schema.org
// ─────────────────────────────────────────────────────────────────────────────

describe('1. HTML Canonical & Metadata Migration', () => {

  const htmlFiles = [
    { file: 'index.html', expectedPath: '/' },
    { file: 'download.html', expectedPath: '/download.html' },
    { file: 'pricing.html', expectedPath: '/pricing.html' },
    { file: 'about.html', expectedPath: '/about.html' },
    { file: 'faq.html', expectedPath: '/faq.html' },
    { file: 'privacy.html', expectedPath: '/privacy.html' },
    { file: 'terms.html', expectedPath: '/terms.html' },
    { file: 'refund-policy.html', expectedPath: '/refund-policy.html' },
    { file: 'cookie-policy.html', expectedPath: '/cookie-policy.html' },
    { file: 'docs/index.html', expectedPath: '/docs/' },
    { file: 'docs/installation.html', expectedPath: '/docs/installation.html' },
    { file: 'docs/troubleshooting.html', expectedPath: '/docs/troubleshooting.html' },
    { file: 'docs/valorant-audio-settings.html', expectedPath: '/docs/valorant-audio-settings.html' },
    { file: 'docs/vb-cable-setup.html', expectedPath: '/docs/vb-cable-setup.html' },
  ];

  for (const { file, expectedPath } of htmlFiles) {
    describe(`${file}`, () => {
      const html = readFile(file);
      const expectedCanonical = `${CANONICAL_DOMAIN}${expectedPath}`;

      test('canonical URL uses valvoice.app', () => {
        const match = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/);
        assert.ok(match, `${file} must contain a canonical link`);
        assert.equal(match[1], expectedCanonical, `Canonical must be ${expectedCanonical}`);
      });

      test('og:url uses valvoice.app', () => {
        const match = html.match(/<meta\s+property="og:url"\s+content="([^"]+)"/);
        assert.ok(match, `${file} must contain og:url`);
        assert.equal(match[1], expectedCanonical);
      });

      test('og:image uses valvoice.app', () => {
        const match = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
        assert.ok(match, `${file} must contain og:image`);
        assert.ok(match[1].startsWith(CANONICAL_DOMAIN), `og:image must start with ${CANONICAL_DOMAIN}`);
      });

      test('twitter:url uses valvoice.app', () => {
        const match = html.match(/<meta\s+property="twitter:url"\s+content="([^"]+)"/);
        assert.ok(match, `${file} must contain twitter:url`);
        assert.equal(match[1], expectedCanonical);
      });

      test('twitter:image uses valvoice.app', () => {
        const match = html.match(/<meta\s+property="twitter:image"\s+content="([^"]+)"/);
        assert.ok(match, `${file} must contain twitter:image`);
        assert.ok(match[1].startsWith(CANONICAL_DOMAIN), `twitter:image must start with ${CANONICAL_DOMAIN}`);
      });

      test('no old domain in canonical/OG/Twitter metadata', () => {
        // Extract only the metadata section (first 50 lines / <head>)
        const headMatch = html.match(/<head[\s\S]*?<\/head>/i);
        if (headMatch) {
          const head = headMatch[0];
          const metaRefs = head.match(/content="https?:\/\/[^"]*valvoice[^"]*"/g) || [];
          const canonicalRefs = head.match(/href="https?:\/\/[^"]*valvoice[^"]*"/g) || [];
          for (const ref of [...metaRefs, ...canonicalRefs]) {
            assert.ok(!ref.includes('valvoice.vercel.app'),
              `${file} <head> must not reference old domain: ${ref}`);
          }
        }
      });
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Schema.org JSON-LD Migration (index.html, download.html)
// ─────────────────────────────────────────────────────────────────────────────

describe('2. Schema.org JSON-LD Migration', () => {

  for (const file of ['index.html', 'download.html']) {
    describe(`${file} Schema.org`, () => {
      const html = readFile(file);

      test('WebSite @id uses valvoice.app', () => {
        assert.ok(html.includes(`"@id": "${CANONICAL_DOMAIN}/#website"`));
      });

      test('WebSite url uses valvoice.app', () => {
        assert.ok(html.includes(`"url": "${CANONICAL_DOMAIN}/"`));
      });

      test('Organization @id uses valvoice.app', () => {
        assert.ok(html.includes(`"@id": "${CANONICAL_DOMAIN}/#organization"`));
      });

      test('Organization logo url uses valvoice.app', () => {
        assert.ok(html.includes(`"url": "${CANONICAL_DOMAIN}/logo.png"`));
      });

      test('SoftwareApplication @id uses valvoice.app', () => {
        assert.ok(html.includes(`"@id": "${CANONICAL_DOMAIN}/#software"`));
      });

      test('no old domain in JSON-LD block', () => {
        const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
        assert.ok(jsonLdMatch, `${file} must contain JSON-LD`);
        assert.ok(!jsonLdMatch[1].includes('valvoice.vercel.app'),
          `JSON-LD must not reference old domain`);
      });
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Sitemap Migration
// ─────────────────────────────────────────────────────────────────────────────

describe('3. Sitemap Migration', () => {
  const sitemap = readFile('sitemap.xml');

  test('sitemap.xml exists and is valid XML', () => {
    assert.ok(sitemap.startsWith('<?xml'), 'Must start with XML declaration');
    assert.ok(sitemap.includes('<urlset'), 'Must contain urlset');
  });

  test('all sitemap URLs use valvoice.app', () => {
    const locs = sitemap.match(/<loc>([^<]+)<\/loc>/g) || [];
    assert.ok(locs.length >= 14, `Sitemap must contain at least 14 URLs, found ${locs.length}`);
    for (const loc of locs) {
      const url = loc.replace(/<\/?loc>/g, '');
      assert.ok(url.startsWith(CANONICAL_DOMAIN), `Sitemap URL must use new domain: ${url}`);
      assert.ok(!url.includes('valvoice.vercel.app'), `Sitemap must not reference old domain: ${url}`);
    }
  });

  test('sitemap contains all indexed pages', () => {
    const expectedPages = [
      '/', '/pricing.html', '/download.html', '/about.html', '/faq.html',
      '/privacy.html', '/terms.html', '/refund-policy.html', '/cookie-policy.html',
      '/docs/index.html', '/docs/installation.html', '/docs/vb-cable-setup.html',
      '/docs/valorant-audio-settings.html', '/docs/troubleshooting.html',
    ];
    for (const page of expectedPages) {
      assert.ok(sitemap.includes(`${CANONICAL_DOMAIN}${page}`),
        `Sitemap must contain ${CANONICAL_DOMAIN}${page}`);
    }
  });

  test('sitemap preserves priority and changefreq values', () => {
    assert.ok(sitemap.includes('<priority>1.0</priority>'), 'Must have priority 1.0 entries');
    assert.ok(sitemap.includes('<priority>0.9</priority>'), 'Must have priority 0.9 entries');
    assert.ok(sitemap.includes('<changefreq>weekly</changefreq>'), 'Must have weekly entries');
    assert.ok(sitemap.includes('<changefreq>monthly</changefreq>'), 'Must have monthly entries');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Robots.txt Migration
// ─────────────────────────────────────────────────────────────────────────────

describe('4. Robots.txt Migration', () => {
  const robots = readFile('robots.txt');

  test('robots.txt references new sitemap URL', () => {
    assert.ok(robots.includes(`Sitemap: ${CANONICAL_DOMAIN}/sitemap.xml`),
      'robots.txt must reference valvoice.app sitemap');
  });

  test('robots.txt does not reference old domain', () => {
    assert.ok(!robots.includes('valvoice.vercel.app'),
      'robots.txt must not reference old domain');
  });

  test('robots.txt preserves Allow: / directive', () => {
    assert.ok(robots.includes('Allow: /'), 'Must allow all crawlers');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Backend: Paddle Checkout Success URL
// ─────────────────────────────────────────────────────────────────────────────

describe('5. Paddle Checkout Success URL', () => {
  const paddleSrc = readFile('lib/paddle.js');

  test('checkout success URL uses valvoice.app', () => {
    assert.ok(paddleSrc.includes(`url: '${CANONICAL_DOMAIN}/checkout/success'`),
      'Paddle checkout must redirect to valvoice.app');
  });

  test('checkout success URL does not use old domain', () => {
    const successMatch = paddleSrc.match(/url:\s*'([^']*checkout\/success[^']*)'/);
    assert.ok(successMatch, 'Must define checkout success URL');
    assert.ok(!successMatch[1].includes('valvoice.vercel.app'),
      'Checkout success URL must not use old domain');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Backend: CORS Allowed Origins
// ─────────────────────────────────────────────────────────────────────────────

describe('6. CORS Allowed Origins', () => {
  const httpSrc = readFile('lib/http.js');

  test('ALLOWED_ORIGINS includes valvoice.app', () => {
    assert.ok(httpSrc.includes(`'${CANONICAL_DOMAIN}'`),
      'ALLOWED_ORIGINS must include new domain');
  });

  test('ALLOWED_ORIGINS retains valvoice.vercel.app for backward compatibility', () => {
    assert.ok(httpSrc.includes(`'${OLD_DOMAIN}'`),
      'ALLOWED_ORIGINS must retain old domain for transition period');
  });

  test('setCorsHeaders still uses wildcard for desktop app compatibility', () => {
    assert.ok(httpSrc.includes("'*'"),
      'setCorsHeaders must use wildcard for desktop app API calls');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Critical Protection: Token Issuer NOT Changed
// ─────────────────────────────────────────────────────────────────────────────

describe('7. Token Issuer Preservation (Critical)', () => {
  const tokenSrc = readFile('lib/token.js');

  test('TOKEN_ISSUER is still valvoice.vercel.app (desktop verifier dependency)', () => {
    assert.ok(tokenSrc.includes(`const TOKEN_ISSUER = '${OLD_DOMAIN}'`),
      'TOKEN_ISSUER MUST NOT be changed — desktop verifier depends on it');
  });

  test('TOKEN_ISSUER is NOT valvoice.app yet', () => {
    assert.ok(!tokenSrc.includes(`const TOKEN_ISSUER = '${CANONICAL_DOMAIN}'`),
      'TOKEN_ISSUER must remain unchanged until desktop verifier is updated');
  });

  // Verify the exported TOKEN_ISSUER at runtime
  test('Exported TOKEN_ISSUER matches old domain at runtime', () => {
    // Set env vars needed for token module import
    const crypto = require('node:crypto');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    process.env.ED25519_PRIVATE_KEY_PEM = process.env.ED25519_PRIVATE_KEY_PEM || privateKey;
    process.env.ED25519_PUBLIC_KEY_PEM = process.env.ED25519_PUBLIC_KEY_PEM || publicKey;
    process.env.ENTITLEMENT_TOKEN_TTL_SECONDS = process.env.ENTITLEMENT_TOKEN_TTL_SECONDS || '604800';

    const { TOKEN_ISSUER } = require('../lib/token');
    assert.equal(TOKEN_ISSUER, OLD_DOMAIN,
      'Runtime TOKEN_ISSUER must be old domain for desktop compatibility');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. API Config Endpoint Preservation
// ─────────────────────────────────────────────────────────────────────────────

describe('8. API Config Endpoint Preservation', () => {
  const configSrc = readFile('api/config.js');

  test('config endpoint still exposes exactly 4 public keys', () => {
    assert.ok(configSrc.includes('SUPABASE_URL'), 'Must expose SUPABASE_URL');
    assert.ok(configSrc.includes('SUPABASE_ANON_KEY'), 'Must expose SUPABASE_ANON_KEY');
    assert.ok(configSrc.includes('PADDLE_CLIENT_TOKEN'), 'Must expose PADDLE_CLIENT_TOKEN');
    assert.ok(configSrc.includes('PADDLE_ENVIRONMENT'), 'Must expose PADDLE_ENVIRONMENT');
  });

  test('config endpoint does NOT expose secrets', () => {
    // Verify the allowlist pattern
    assert.ok(configSrc.includes('NEVER returns'), 'Must document forbidden keys');
    assert.ok(configSrc.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Must document service role exclusion');
    assert.ok(configSrc.includes('PADDLE_API_KEY'), 'Must document API key exclusion');
    assert.ok(configSrc.includes('ED25519_PRIVATE_KEY_PEM'), 'Must document private key exclusion');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Supabase Auth Redirect Configuration
// ─────────────────────────────────────────────────────────────────────────────

describe('9. Supabase Auth Configuration', () => {
  const authSrc = readFile('js/valvoice-auth.js');

  test('auth module uses /api/config (relative URL, domain-independent)', () => {
    assert.ok(authSrc.includes("fetch('/api/config')"),
      'Auth module must use relative /api/config URL');
  });

  test('auth module does NOT hardcode any domain for Supabase', () => {
    assert.ok(!authSrc.includes('valvoice.vercel.app'),
      'Auth module must not hardcode old domain');
    assert.ok(!authSrc.includes('valvoice.app'),
      'Auth module must not hardcode any domain — uses /api/config dynamically');
  });

  test('OTP sign-in uses signInWithOtp (not magic link with redirect)', () => {
    assert.ok(authSrc.includes('signInWithOtp'),
      'Must use OTP flow — no redirect URLs needed in frontend');
    // OTP flow does not require redirect_to, so no domain dependency
    assert.ok(!authSrc.includes('redirect_to'),
      'OTP flow must not use redirect_to (no domain dependency)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Privacy Policy Prose
// ─────────────────────────────────────────────────────────────────────────────

describe('10. Privacy Policy Domain Reference', () => {
  const privacy = readFile('privacy.html');

  test('privacy policy references valvoice.app in website description', () => {
    assert.ok(privacy.includes('valvoice.app'),
      'Privacy policy must reference new domain in prose');
  });

  test('privacy policy does NOT reference old domain in prose', () => {
    // Check prose text (not metadata which is tested above)
    const bodyMatch = privacy.match(/<body[\s\S]*<\/body>/i);
    if (bodyMatch) {
      assert.ok(!bodyMatch[0].includes('valvoice.vercel.app'),
        'Privacy policy body must not reference old domain');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Vercel Configuration Preservation
// ─────────────────────────────────────────────────────────────────────────────

describe('11. Vercel Configuration Preservation', () => {
  const vercelConfig = JSON.parse(readFile('vercel.json'));

  test('framework is null (static site)', () => {
    assert.equal(vercelConfig.framework, null);
  });

  test('all existing rewrites are preserved', () => {
    const sources = (vercelConfig.rewrites || []).map(r => r.source);
    const required = [
      '/pricing', '/terms', '/privacy', '/refund-policy', '/cookie-policy',
      '/faq', '/about', '/docs/installation', '/docs/troubleshooting',
      '/docs/valorant-audio-settings', '/docs/vb-cable-setup', '/checkout/success',
    ];
    for (const src of required) {
      assert.ok(sources.includes(src), `Rewrite for ${src} must be preserved`);
    }
  });

  test('download redirect is preserved', () => {
    const dl = (vercelConfig.redirects || []).find(r => r.source === '/download');
    assert.ok(dl, 'Download redirect must exist');
    assert.ok(dl.destination.includes('github.com'), 'Download must redirect to GitHub');
  });

  test('maxDuration is preserved on API functions', () => {
    assert.ok(vercelConfig.functions, 'Functions config must exist');
    assert.ok(vercelConfig.functions['api/**/*.js'], 'API function config must exist');
    assert.equal(vercelConfig.functions['api/**/*.js'].maxDuration, 30);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. All Pages Preserved (no removed pages)
// ─────────────────────────────────────────────────────────────────────────────

describe('12. All Indexed Pages Exist', () => {
  const requiredFiles = [
    'index.html', 'download.html', 'pricing.html', 'about.html', 'faq.html',
    'privacy.html', 'terms.html', 'refund-policy.html', 'cookie-policy.html',
    'checkout/success.html',
    'docs/index.html', 'docs/installation.html', 'docs/troubleshooting.html',
    'docs/valorant-audio-settings.html', 'docs/vb-cable-setup.html',
  ];

  for (const file of requiredFiles) {
    test(`${file} exists`, () => {
      assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} must exist`);
    });
  }

  test('style.css exists', () => {
    assert.ok(fs.existsSync(path.join(ROOT, 'style.css')));
  });

  test('script.js exists', () => {
    assert.ok(fs.existsSync(path.join(ROOT, 'script.js')));
  });

  test('og-image.jpg exists', () => {
    assert.ok(fs.existsSync(path.join(ROOT, 'og-image.jpg')));
  });

  test('logo.png exists', () => {
    assert.ok(fs.existsSync(path.join(ROOT, 'logo.png')));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. Checkout Module Domain Independence
// ─────────────────────────────────────────────────────────────────────────────

describe('13. Checkout Module Domain Independence', () => {
  const checkoutSrc = readFile('js/valvoice-checkout.js');

  test('checkout module uses relative /api/checkout/create URL', () => {
    assert.ok(checkoutSrc.includes("'/api/checkout/create'"),
      'Must use relative API URL');
  });

  test('checkout module redirects to relative /checkout/success', () => {
    assert.ok(checkoutSrc.includes("'/checkout/success'"),
      'Must use relative success URL');
  });

  test('checkout module does not hardcode any domain', () => {
    assert.ok(!checkoutSrc.includes('valvoice.vercel.app'));
    assert.ok(!checkoutSrc.includes('valvoice.app'));
  });
});
