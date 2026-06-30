# Math Tutor

Cross-curriculum math (and reading) practice for globally-mobile families.
Originally grades 3–5; content now spans grades 1–8 across four curricula
(US Common Core, UK, Singapore, Ontario). One Supabase backend, multiple surfaces:

- **Web app** (`web/`, Next.js 15 / React 19 → Railway) — parent signup, add
  child, adaptive placement, daily practice, parent dashboard, reading
  comprehension, lessons/learning path, AI-literacy course + capstone, Stripe
  billing, and a marketing site. This is the primary surface today.
- **Question generator** (`generator/`, Anthropic API) — **offline, batch only.**
  Produces draft questions/passages/lessons that a human vets before serving.
- **Telegram bot** (`bot/`, Python + python-telegram-bot) — **planned, not yet
  built.** The web practice backend is intentionally surface-agnostic so the bot
  (and a future native app) can reuse the same endpoints.

> Current status, live DB snapshot, and open security items live in
> [`docs/STATUS.md`](docs/STATUS.md).

**Hard rule:** no live LLM in the child-facing path. The bot serves only
`questions.status = 'vetted'`. The Anthropic API is used solely by the offline
generator. See `docs/` and the handoff brief for full guardrails (COPPA/GDPR,
RLS on every table, minimal child PII).

## Layout

```
supabase/
  migrations/                        22 migrations (0001_init → 0022_ai_course)
  seed/                              skill ladders per curriculum (source of truth)
  apply_migrations.py                applies migrations over the session pooler
web/                                 Next.js web app — the primary surface
generator/                           offline question/passage/lesson pipeline
bot/                                 Telegram worker            (planned, M3)
docs/STATUS.md                       live status & decisions log
```

## Setup (once a DEDICATED Supabase project exists)

1. Apply the schema: run `supabase/migrations/0001_init.sql` against the project
   (CLI `supabase db push`, the SQL editor, or MCP `apply_migration`).
2. Copy `.env.example` → `.env` and fill in the keys.
3. Seed the skill ladder:
   ```bash
   pip install supabase
   export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
   python supabase/seed/seed_skills.py
   ```

## Build order

M0 scaffold → M1 question bank → M2 web onboarding + placement → M3 Telegram
core → M4 parent dashboard → M5 polish. Status in `docs/STATUS.md`.
