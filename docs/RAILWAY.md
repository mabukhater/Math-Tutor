# Deploy the web app on Railway

Railway deploys the Next.js app directly from GitHub and **auto-redeploys on every
push** — no manual pulls, no Replit Agent, no template. The app lives in `web/`,
so the one thing that matters is pointing Railway's **root directory** at `web`.

## One-time setup (~4 steps)

1. **railway.app → New Project → Deploy from GitHub repo → `mabukhater/Math-Tutor`.**
   (Authorize Railway for the repo if prompted.)
2. Open the service → **Settings → Root Directory → set to `web`** → save.
   (`web/railway.json` then provides the build/start commands automatically.)
3. **Settings → Variables** → add these four:
   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://gyaprlbdbzbpfulcanfa.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role key |
   | `ADMIN_EMAILS` | `demo@mathtutor.test,mabukhater@gmail.com` |
4. **Settings → Networking → Generate Domain** to get a public `*.up.railway.app` URL.

Railway builds (`npm install` → `npm run build`) and starts
(`next start` on Railway's `$PORT`). Done.

## From then on
Every `git push` to `main` triggers an automatic redeploy in ~1 minute. You never
pull or touch git again.

## Notes
- `NEXT_PUBLIC_*` vars are read at build time — Railway provides them at build, so
  they're baked in correctly.
- This replaces Replit for the web app. The Telegram bot (M3) can deploy as a
  second Railway service from `bot/` later.
