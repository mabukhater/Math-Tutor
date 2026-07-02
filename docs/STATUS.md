# Build status & decisions

> **Last refreshed: 2026-06-30** against the live Supabase project
> (`gyaprlbdbzbpfulcanfa`), the repo on `main`, and a local build/test run.
> The project has grown well beyond the original 3-surface MVP — this file is
> the source of truth for "where things stand"; the section history below is
> kept for the decisions log.

## Confirmed decisions (2026-06-14)
1. **Curriculum:** US Common Core (default), now joined by UK, Singapore, Ontario.
2. **Placement location:** web app (default accepted).
3. **Bot stack:** Python + `python-telegram-bot` (planned; **not yet built**).
4. **Questions/day:** 10; new-skills/day cap 2–3 (defaults accepted).
5. **Grade band:** originally 3–5; content now spans grades 1–8 (AI literacy
   course is grade 7–8 gated).

## Live state snapshot (2026-06-30, project `gyaprlbdbzbpfulcanfa`)
- **Curricula (4) / skills (342):** US Common Core 134, UK National Curriculum
  97, Singapore Math 93, Ontario 18.
- **Math questions: 18,558 total** — 13,493 vetted, 4,851 retired, 214 draft.
  Vetting is effectively complete; surfaces serve `status='vetted'` only.
- **Reading: 121 passages, 1,165 reading_questions** (1,045 vetted, 120 retired).
- **Content scaffolding:** 225 lessons, 27 path_blocks, 27 reading_blocks,
  14 topics, 18 expectations, 1 year_plan (36 weeks / 48 items),
  12 capstone milestone templates.
- **Real usage:** 5 parents, 12 students, 560 attempts, 64 skill-progress rows,
  10 placement sessions, 4 kid_logins, 4 daily_sessions, 17 reading_progress,
  2 contact messages.
- **Unused yet:** capstones (0 rows — feature shipped, no data),
  telegram_link_tokens (0 — bot not built), waitlist & landing_views (0).
- **Migration tracking drift:** 22 migration files exist in `supabase/migrations`
  but the Supabase migration ledger records only one (`ai_literacy_course`).
  Migrations have been applied directly (via `apply_migrations.py` / SQL editor),
  so the schema is correct but `supabase migration list` will not match the repo.

## Milestones
- [x] **M0 — Scaffold.** Applied + verified on `gyaprlbdbzbpfulcanfa`. Original
      10 tables have grown to 30+ (math, reading, lessons, learning path,
      year plan, capstone, billing, kid logins, marketing/waitlist).
- [x] **M1 — Question bank.** Generated and **vetted**: 13,493 vetted math
      questions + 1,045 vetted reading questions across 4 curricula. Generator
      pipeline (`generator/`) covers questions, vetting, lessons, passages,
      visual questions, and blog posts.
- [x] **M2 — Web onboarding + placement.** Next.js 15 / React 19 app: Supabase
      SSR auth (login/signup, middleware-gated), add-child, deterministic
      placement engine + age-based placement (unit-tested), server-side
      placement API (answers never reach the browser), result screen.
      Now unblocked end-to-end — vetted questions exist.
- [x] **Web practice (shared backend).** Surface-agnostic Leitner/spaced-rep
      logic (`practice.ts`) + server (`practiceServer.ts`) + `/api/practice/*`
      + `/practice` UI. All progress writes to the shared DB.
- [ ] **M3 — Telegram core.** **Not started.** No `bot/` directory yet.
      The practice backend was deliberately built surface-agnostic so the bot
      (and a future native app) reuse the same endpoints.
- [x] **M4 — Parent dashboard.** Per-child progress: level, streak, accuracy,
      skills mastered, last-7-days, Leitner mastery map, attempts explorer,
      response-time capture.
- [~] **M5 — Polish.** Ongoing. Timezones / pause / error states still open.

## Features beyond the original MVP (all shipped to `main`)
- **Reading comprehension** — passages, difficulty, weekly reading blocks/plans.
- **Lessons + learning path + topics + Ontario year plan.**
- **AI literacy course + capstone subsystem** — grade 7–8 gated; milestones,
  artifacts, parent attestation (templates seeded, no live capstones yet).
- **Stripe billing** — checkout + per-child add-on ($3/mo).
- **Marketing site** — per-curriculum landing pages (US/UK/Singapore), pricing,
  FAQ, blog, about, privacy/terms, demo, in-app `/vet` review screen.
- **Kid logins** — child-scoped sign-in distinct from the parent account.

## Verification (2026-06-30, this machine: Node v26, npm 11)
- **Unit tests:** `npm test` in `web/` — **72/72 pass** (blockSelection,
  placement, agePlacement, practice, aiCourse).
- **Build:** `next build` **compiles cleanly (3.8s)** but **fails at prerender
  of `/login`** because no `web/.env.local` exists on this machine
  (`@supabase/ssr` requires URL + anon key at build time). This is an env-config
  gap, not a code regression — Railway has the vars set, so production builds.
  To build locally, create `web/.env.local` from `.env.local.example`.

## Security advisors (from Supabase linter, 2026-06-30) — review before launch
- **ERROR — RLS disabled:** `reading_questions_distractor_backup_20260628` is a
  public table with RLS off, fully readable/writable via the anon key. It's a
  leftover backup from a distractor migration — **drop it or enable RLS.**
- **ERROR — SECURITY DEFINER views:** `question_stats`,
  `question_calibration_flags` run as their creator, bypassing caller RLS.
- **WARN — mutable search_path:** function `skills_with_vetted`.
- **WARN — Auth:** leaked-password protection (HaveIBeenPwned) is disabled.
- **INFO — RLS enabled, no policy:** `questions`, `reading_questions`,
  `telegram_link_tokens` (intentional — service-role-only per guardrails);
  also `contact_messages`, `waitlist`, `landing_views` — confirm these have the
  insert policies the public forms need, or writes will be blocked.

## Resolved blocker — dedicated Supabase project
The original blocker (MCP bound to an unrelated production project) is resolved.
The math tutor runs on its own dedicated project `gyaprlbdbzbpfulcanfa`
("Math Tutor"), schema applied and in active use.

## Guardrails (do not skip)
- No live LLM math to children. Surfaces serve `status='vetted'` only; the
  Anthropic API is used solely by the offline `generator/`.
- Minimal child PII: first name/nickname + grade only.
- RLS on every table; service-role-only for `questions`,
  `reading_questions`, and `telegram_link_tokens` (RLS on, no policies).
- COPPA/GDPR: parent is the consent holder; children cannot self-register.
  Get the consent flow + privacy policy reviewed before any public launch.
