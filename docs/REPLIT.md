# Deploying the web app to Replit

The web app is `web/` (Next.js). The repo root `.replit` is already configured to
install, build, and run that subdirectory — so importing the GitHub repo is enough.

## 1. Import the repo
- Replit → **Create Repl** → **Import from GitHub** → `mabukhater/Math-Tutor`.
- It picks up the root `.replit` (Node 20, runs `web/`).

## 2. Add Secrets (Replit → Tools → Secrets)
Add these three (same values as local `web/.env.local`):

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://gyaprlbdbzbpfulcanfa.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the project's anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | the project's service_role key (server-side only) |

> `NEXT_PUBLIC_*` are exposed to the browser by design; `SUPABASE_SERVICE_ROLE_KEY`
> must stay server-side — never prefix it with `NEXT_PUBLIC_`.

## 3. Run
- Press **Run**. First boot installs deps and starts `next dev` on port 3000,
  which Replit maps to your public `*.replit.dev` URL.

## 4. Point Supabase Auth at the Replit URL (for email signup)
Supabase → **Authentication → URL Configuration**:
- **Site URL**: your Replit app URL (e.g. `https://<repl>.<user>.replit.dev`)
- **Redirect URLs**: add the same URL.

Password login with a pre-confirmed account works without this; it's needed for
email-confirmation links to land back on the app.

## 5. Production
Use **Replit → Deployments → Autoscale**. The `[deployment]` block in `.replit`
already runs `npm run build` then `npm run start`. Add the same three Secrets to
the deployment.

## Notes
- `web/.env.local` is gitignored and is **not** imported — Secrets are the source
  of truth on Replit.
- The Python pieces (`generator/`, `bot/`) are not run by this Repl; they're
  separate workers (the bot deploys to Railway in M3).
