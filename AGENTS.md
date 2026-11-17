# ValVoice-Site Agent Rules

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
  --field sha="<current file sha>"
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
- Preserve `"framework": null` — this is a static site with serverless API functions, not a framework project.
- Preserve `maxDuration` settings on API functions.

## Protected Files

Do not modify without explicit request:
- `supabase/migrations/` — Database schema
- Environment variables (`.env`, Vercel dashboard)
- Paddle webhook secrets and API keys

## Do Not

- Activate Paddle Live mode
- Modify the desktop ValVoice repository from this project
- Delete or replace Vercel deployments manually
- Introduce framework dependencies (React, Next.js, etc.)