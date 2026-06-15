# Math Tutor MVP

Cross-curriculum math practice for globally-mobile families, grades 3–5.
Two surfaces over one Supabase backend:

- **Web app** (`web/`, Next.js → Replit) — parent signup, add child, adaptive
  placement, parent dashboard.
- **Telegram bot** (`bot/`, Python + python-telegram-bot → Railway) — daily MCQ
  practice with instant feedback, streaks, and Leitner spaced repetition.
- **Question generator** (`generator/`, Anthropic API) — **offline, batch only.**
  Produces draft questions that a human vets before they are ever served.

**Hard rule:** no live LLM in the child-facing path. The bot serves only
`questions.status = 'vetted'`. The Anthropic API is used solely by the offline
generator. See `docs/` and the handoff brief for full guardrails (COPPA/GDPR,
RLS on every table, minimal child PII).

## Layout

```
supabase/
  migrations/0001_init.sql           schema + RLS + indexes + curricula seed
  seed/skills_common_core_3_5.json   the skill ladder (source of truth)
  seed/seed_skills.py                loads the ladder into the skills table
web/                                 Next.js web app            (M2, M4)
bot/                                 Telegram worker            (M3)
generator/                           offline question pipeline  (M1)
docs/STATUS.md                       milestone status & decisions log
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
