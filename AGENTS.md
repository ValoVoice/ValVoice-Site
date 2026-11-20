# ValVoice-Site Agent Rules

## Git Identity (Mandatory)

All commits to this repository and any ValoVoice organization repositories **must** use:

| Field | Value |
|---|---|
| **Author name** | `ValVoice` |
| **Author email** | `valorantvoiceofficials@gmail.com` |
| **Committer name** | `ValVoice` |
| **Committer email** | `valorantvoiceofficials@gmail.com` |

Never use personal emails (e.g. `shreyashgupta999@gmail.com`) for ValoVoice commits.

When committing via the GitHub API, always pass:
```json
"author": {"name": "ValVoice", "email": "valorantvoiceofficials@gmail.com"},
"committer": {"name": "ValVoice", "email": "valorantvoiceofficials@gmail.com"}
```

## Commit Policy (Mandatory)

**Always commit directly to GitHub using the GitHub API (`gh api`) or GitHub Contents API.**

Never use local `git commit` + `git push` for this repository.

This ensures Vercel deployment webhooks fire immediately and reliably on every commit.

### How to commit:
```bash
gh api repos/ValoVoice/ValVoice-Site/contents/<path> \
  --method PUT \
  --field message="<commit message>" \
  --field content="<base64 content>" \
  --field sha="<current file sha>" \
  --field "author[name]=ValVoice" \
  --field "author[email]=valorantvoiceofficials@gmail.com" \
  --field "committer[name]=ValVoice" \
  --field "committer[email]=valorantvoiceofficials@gmail.com"
```

## Deployment Architecture

| Component | Service |
|---|---|
| Hosting | Vercel (auto-deploys from `main`) |
| Functions | Vercel Serverless (Node.js, auto-detected) |
| Domain | valvoice.app |
| Repository | `ValoVoice/ValVoice-Site` |

## Vercel Configuration Rules

- **Never** set `"runtime"` in `vercel.json` `functions` block. Vercel uses its native Node.js runtime automatically.
- Pin the Node.js version via `"engines": {"node": "22.x"}` in `package.json`.
- Preserve `"framework": null` â€” this is a static site with serverless API functions, not a framework project.
- Preserve `maxDuration` settings on API functions.

## Favicon & Brand Assets (Mandatory)

The site uses the red ValVoice microphone/shield logo (`logo.png`, 1024Ã—1024) as the single source of truth for all favicon and icon derivatives. The following invariants must be maintained:

### Favicon Files (Root Directory)

| File | Dimensions | Purpose |
|------|-----------|---------|
| `favicon.ico` | 16Ã—16 + 32Ã—32 + 48Ã—48 | Multi-resolution ICO for browsers and Google Search |
| `favicon.png` | 96Ã—96 | General-purpose PNG favicon |
| `favicon-48x48.png` | 48Ã—48 | Small PNG favicon |
| `favicon-96x96.png` | 96Ã—96 | Medium PNG favicon |
| `favicon-192x192.png` | 192Ã—192 | Google Search and Android home screen |
| `favicon-512x512.png` | 512Ã—512 | PWA splash screen |
| `apple-touch-icon.png` | 180Ã—180 | iOS home screen icon |
| `site.webmanifest` | â€” | PWA manifest declaring icon paths and sizes |

### Favicon Rules

1. **All favicon files must be derived from `logo.png`.** Never create a different logo, substitute a placeholder, or use a generic icon.
2. **Never delete or rename favicon files.** All 7 image files + `site.webmanifest` must exist in the repository root and be publicly accessible (HTTP 200, no authentication, correct MIME types).
3. **Never use `logo.png` directly as a favicon.** It is 1 MB+ and browsers/Google will ignore it. Always reference the properly sized derivatives.
4. **All HTML `<head>` sections must contain the standard favicon block:**
   ```html
   <link rel="icon" type="image/x-icon" href="/favicon.ico">
   <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
   <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png">
   <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png">
   <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
   <meta name="theme-color" content="#f5192e">
   <link rel="manifest" href="/site.webmanifest">
   ```
5. **Always use root-relative URLs** (`/favicon.ico`, not `favicon.ico`). Relative URLs break on subpages.
6. **When adding a new HTML page**, copy the full favicon block into its `<head>`. Never ship a page with only `<link rel="icon" href="logo.png">` or without favicon declarations.
7. **If `logo.png` is updated**, regenerate all 7 favicon derivatives from it. Never leave stale derivatives that show a different icon than the current logo.
8. **`site.webmanifest` must stay in sync** with the favicon files. If favicon filenames or sizes change, update the manifest.
9. **`robots.txt` must never block** `/favicon.ico`, `/favicon-*.png`, `/apple-touch-icon.png`, or `/site.webmanifest`.

### SEO Asset Verification Checklist

Before committing changes that touch HTML `<head>`, favicon files, `robots.txt`, or `vercel.json`:

- [ ] Every HTML page has the full favicon block (all 7 lines)
- [ ] `/favicon.ico` returns HTTP 200 with `image/vnd.microsoft.icon`
- [ ] `/favicon-192x192.png` returns HTTP 200 with `image/png`
- [ ] `/site.webmanifest` returns HTTP 200 with `application/manifest+json`
- [ ] `/robots.txt` does not block favicon paths
- [ ] All favicon `href` values are root-relative (start with `/`)
- [ ] `<meta name="theme-color" content="#f5192e">` is present on every page
- [ ] `logo.png` is only referenced for visual display (header, footer, structured data) â€” never as a favicon

## Protected Files

Do not modify without explicit request:
- `supabase/migrations/` â€” Database schema
- Environment variables (`.env`, Vercel dashboard)
- Paddle webhook secrets and API keys
- `logo.png` â€” Brand logo (source of truth for all favicon derivatives)

## Do Not

- Activate Paddle Live mode
- Modify the desktop ValVoice repository from this project
- Delete or replace Vercel deployments manually
- Introduce framework dependencies (React, Next.js, etc.)
- Use `logo.png` as a favicon source in HTML `<link>` tags (use the sized derivatives)
- Delete favicon files, `site.webmanifest`, or `apple-touch-icon.png`
- Ship any HTML page without the standard favicon block in `<head>`