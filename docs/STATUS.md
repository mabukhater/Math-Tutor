# Build status & decisions

## Confirmed decisions (2026-06-14)
1. **Curriculum:** US Common Core (default accepted).
2. **Placement location:** web app (default accepted).
3. **Bot stack:** Python + `python-telegram-bot` (matches the Quran bot).
4. **Questions/day:** 10; new-skills/day cap 2–3 (defaults accepted).
5. **Grade band:** 3–5 (default accepted).

## Milestones
- [~] **M0 — Scaffold.** Repo + schema + RLS + indexes written. Skill ladder
      (75 CCSS skills, grades 3–5) authored as JSON + seed script.
      **BLOCKED on a dedicated Supabase project** — see below. Nothing applied
      to a live DB yet.
- [~] **M1 — Question bank.** Generator + vetting CLI written (code-complete).
      `generator/generate_questions.py` (Anthropic `claude-opus-4-8`, structured
      outputs → draft rows) and `generator/vet_questions.py` (human vet/retire).
      **Not yet run** — needs the live DB + ANTHROPIC_API_KEY. Run once the
      dedicated Supabase project is connected.
- [ ] **M2 — Web onboarding.** Auth → add child → adaptive placement → result.
- [ ] **M3 — Telegram core.** Linking → scheduler → daily set → MCQ → SR updates.
- [ ] **M4 — Parent dashboard.** Level, mastery map, streak, 7-day stats.
- [ ] **M5 — Polish.** Timezones, /pause, error states.

## Open blocker — Supabase project
The connected Supabase MCP is bound to an EXISTING production project
(`qphvsrgeaatbmlhpljht` — the Timesheet / Shoot 360 database: profiles,
court_bookings, pickup_registrations, etc.). The math tutor must NOT share that
database. The MCP exposes no "create project" tool, so a dedicated project must
be provisioned out of band, then either:
  (a) reconnect the Supabase MCP to the new project ref, or
  (b) provide its URL + service-role key so the migration + seed can be applied.

Until then, `0001_init.sql` and `seed_skills.py` are ready to apply in <1 min.

## Guardrails (do not skip)
- No live LLM math to children. Bot serves `status='vetted'` only.
- Minimal child PII: first name/nickname + grade only.
- RLS on every table; service-role-only for `questions` and
  `telegram_link_tokens` (RLS enabled, no policies).
- COPPA/GDPR: parent is the consent holder; children cannot self-register.
  Get consent flow + privacy policy reviewed before any public launch.
