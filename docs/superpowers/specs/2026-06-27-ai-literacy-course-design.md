# AI Literacy Course — Product Spec

**Slug:** ai-literacy-course
**Date:** 2026-06-27
**Status:** Draft — awaiting system-architect review
**Author:** Product

---

## Summary

Add a 24-week, two-level AI literacy course ("AI 7: Foundations" and "AI 8: Builds On") to the existing app by re-using the Reading engine for lesson delivery, and introduce a brand-new "capstone project" subsystem (staged milestones + artifact uploads + parent attestation) for the hands-on project that caps each level. No live LLM is ever shown to children inside the app.

---

## Goals and Non-Goals

### Goals
- Deliver a structured, theory-first AI curriculum for grades 7–8 via the existing passage + quiz engine.
- Gate AI 8 behind completion of AI 7 (a cross-level content prerequisite — new capability).
- Give students a self-serve project experience after each level via a milestone-based capstone subsystem.
- Keep children safe: the app NEVER brokers or proxies access to a live AI model.
- Protect child privacy: capstone artifacts visible only to the child and their parent.

### Non-Goals (this iteration)
- Authoring the 24 passages, quizzes, and capstone kit copy (offline content workstream — out of engineering scope).
- A public project gallery or cross-account visibility of any kind.
- Human grading, a staff review queue, or moderation tooling.
- AI access brokering, OAuth to external AI providers, or COPPA/VERPA consent record storage.
- Grade-gating of AI 7 (any student may enroll regardless of `nominal_grade`).
- In-app AI chat, hint generation, or any live model call to children.
- Billing / subscription changes for this subject (pricing decision is out-of-scope and must be resolved separately before launch).

---

## Scope Boundary

| In Engineering Scope | Out of Engineering Scope |
|---|---|
| New `subject` discriminator on `passages` (or equivalent) to tag AI passages | Authoring 24 AI lesson passages and their quizzes |
| `getReadingPath` / `getOrCreateReadingBlock` reuse for AI subject | Vetting / QA of passage and question content |
| Cross-level unlock: AI 7 completion unlocks AI 8 | Capstone kit copy (instructions, prompt templates, checkpoints) |
| New `capstones`, `capstone_milestones`, `capstone_artifacts`, `capstone_attestations` tables | Any external AI integration or parental consent infrastructure |
| Milestone unlock sequencing (same mental model as reading blocks) | Public showcase, portfolio sharing, or moderation |
| Artifact upload to Supabase Storage + link/text paste | Subscription/billing tier for the AI subject |
| Parent attestation record (final milestone) | Curriculum content (curriculum is offline / editorial) |
| Private portfolio page (child + parent only) | iOS/Android native app changes |
| RLS policies enforcing child+parent-only capstone visibility | |
| Billing gate for AI subject (wiring to existing `checkSubjectGate` once pricing is decided) | |

---

## Context: Real Reading Engine (repo-grounded)

The following facts were confirmed by reading the code and migrations:

**Tables used by the Reading engine:**
- `passages` — `(id, grade, week, level_order, title, paragraphs jsonb, word_count, status, created_at)`. No `subject` column exists today. The ladder is keyed on `grade` + `week` + `level_order`.
- `reading_questions` — service-role-only (RLS on, no policies). `(passage_id, stem, options, correct_index, locator, explanation, difficulty, status)`.
- `reading_progress` — `(student_id, passage_id, passed_at, total_attempts, total_correct)`. A `passed_at` not null means the passage is passed.
- `reading_blocks` — `(student_id, passage_id, question_ids, num_completed, num_correct, passed, threshold, created_at, completed_at)`. `passed = null` means in-progress.

**Key functions:**
- `getReadingPath(admin, student)` — builds the weekly ladder for `student.nominal_grade`, gates on `status = 'published'` passages and `status = 'vetted'` questions. Returns `{ weeks, activePassageId, passedPassages, totalPassages }`.
- `getOrCreateReadingBlock(admin, student, passageId)` — resumes or creates a question block.
- `markPassagePassed(admin, studentId, passageId)` — upserts `reading_progress.passed_at`.

**Subject type today:** `billing.ts` defines `type Subject = "math" | "reading"`. The `passages` table has no subject column — it is implicitly the "reading" subject, gated by `student.nominal_grade`.

**Auth model:** Parent = `auth.users` (`parents.id`). Children have no auth identity; they are `students` rows. Kid logins are synthetic Supabase auth users linked via `kid_logins`. `resolveStudent()` accepts either the parent or the linked kid. The established auth pattern (anon client for session, admin/service-role client for privileged reads/writes) must be preserved throughout.

**Billing gate:** `checkSubjectGate(admin, student, subject)` reads `parents.subscription_plan` and `subscription_subject`. Adding `"ai"` to `Subject` (or however AI is scoped) requires a decision on which plan tier unlocks it.

---

## User Stories and Acceptance Criteria

### 1. Enroll in AI 7 (any student)

**As a parent**, I want to be able to start my child on the AI 7 course from the dashboard, so that they can begin learning about AI regardless of their math or reading grade.

**AC-1.1** — Given a parent is authenticated and has at least one child, when they navigate to the child's subject selection or dashboard, then "AI 7: Foundations" appears as an available subject alongside Math and Reading.

**AC-1.2** — Given AI 7 is available, when the parent (or the child via their kid login) taps "AI 7", then they land on the AI 7 ladder page showing weeks 1–12 with Week 1 active and weeks 2–12 locked.

**AC-1.3** — Given a student of any `nominal_grade` (1–8), when the ladder is rendered, then all 12 AI 7 weeks are shown (grade is advisory context only, not a gate).

**AC-1.4** — Given an AI 7 course page, then no live AI model, no AI-generated text, and no link to an external AI service is visible to the child at any point in the lesson or quiz flow.

---

### 2. Complete a weekly AI lesson + quiz (Reading engine reuse)

**As a student**, I want to read this week's AI lesson and answer quiz questions, so that I build knowledge and unlock the next week.

**AC-2.1** — Given the student is on the active week's passage, when they tap it, then the existing `passage → ReadingBlock → quiz` flow runs exactly as it does for Reading (read passage, then answer ~10 questions in order).

**AC-2.2** — Given the student answers all questions, when their accuracy meets or exceeds `pass_threshold`, then `reading_progress.passed_at` is set, the week is marked passed, and the next week's passage unlocks. The existing `markPassagePassed` function is called unchanged.

**AC-2.3** — Given the student fails (accuracy below `pass_threshold`), when they see the result screen, then they can re-read and retry (same retry flow as Reading: new `reading_block` row, same passage).

**AC-2.4** — Given the AI passage is served to the child's browser, then `correct_index` from `reading_questions` is NEVER included in any client-side response — it is graded server-side via the admin client only (existing invariant, must hold for AI questions too).

**AC-2.5** — Given the end of Week 12 (the last AI 7 week), when the student passes, then a "Course complete" state is shown with a call-to-action to begin the Level 7 capstone project.

---

### 3. AI 7 → AI 8 cross-level unlock

**As a student**, I want AI 8 to unlock automatically once I finish AI 7, so that the progression feels earned and continuous.

**AC-3.1** — Given a student has NOT completed all 12 AI 7 passages (i.e., `reading_progress.passed_at` is not set for all 12 AI 7 passage IDs), when they navigate to AI 8, then AI 8 is shown as locked with a message: "Complete AI 7: Foundations first."

**AC-3.2** — Given a student HAS passed all 12 AI 7 passages, then AI 8 unlocks automatically — no parent action required. The unlock is evaluated at page load time via a server-side query; no background job is needed.

**AC-3.3** — Given AI 8 is unlocked, when the student opens it, then the ladder shows weeks 13–24 with week 13 active and weeks 14–24 locked. Progress within AI 8 follows the same per-passage gate as AI 7.

**Engineering flag (new gating logic):** `getReadingPath` today gates passages within a single `grade`. A cross-level prerequisite (all AI-7 passages passed → unlock AI-8 passages) is NOT modeled by the current function. The system architect must decide the data model for this: options include a dedicated `subject` column on `passages`, a new `course_enrollments` or `level_unlock` table, or a computed function. See Open Questions.

---

### 4. Small (AI-free) Level 7 capstone

**As a student**, I want to complete a short, structured project after finishing AI 7 — without needing an external AI account — so that I practice project-thinking with AI concepts.

**AC-4.1** — Given the student has passed all 12 AI 7 passages, when they open the AI 7 capstone, then they see a milestone checklist with 6 milestones in order: Idea → Plan → Build v1 → Test & Feedback → Ship → Reflect.

**AC-4.2** — Given the capstone is AI-free, then no prompt, link, or instruction within any milestone references a live AI tool or external AI account. "AI-thinking" exercises (e.g., "write the prompt you would send") are text/offline only.

**AC-4.3** — Given the student is on Milestone 1 (Idea), then Milestones 2–6 are locked. Completing and submitting Milestone 1 unlocks Milestone 2, and so on sequentially.

**AC-4.4** — Given a milestone has an artifact requirement (e.g., "upload a photo of your plan" or "paste a link"), when the student submits without the required artifact, then the milestone cannot be marked complete.

**AC-4.5** — Given the student reaches the final milestone (Reflect), then a simple self-assessment rubric is shown with 3 questions (Did it ship? Does it work? Did you document it?). The student selects Yes/No for each; this is recorded but does not block completion.

**AC-4.6** — Given all 6 milestones are submitted and the required artifacts are present, when the parent attests (see AC-6.x), then the L7 capstone is marked complete.

**AC-4.7** — Given the L7 capstone is complete, when the student or parent views the private portfolio, then the L7 capstone entry is visible with its artifacts and rubric answers.

---

### 5. Large (parent-mediated) Level 8 capstone

**As a student**, I want to complete a "ship it to the world" project after AI 8 — guided by a project kit that shows me how to work with an external AI tool my parent provides — so that I experience building and shipping a real AI-assisted product.

**AC-5.1** — Given the student has passed all 12 AI 8 passages (weeks 13–24), when they open the AI 8 capstone, then they see the same 6-milestone spine: Idea → Plan → Build v1 → Test & Feedback → Ship → Reflect.

**AC-5.2** — Given this is the L8 capstone, then the Build v1 and Ship milestones include a "project kit" panel: offline instructions, prompt templates, and checkpoint questions the child can bring to their external AI session. The kit is static copy, not a live AI interface.

**AC-5.3** — Given the child uses an external AI tool (ChatGPT, Claude, etc.) under parent supervision outside the app, when they return to the app, then they can submit results as artifacts: a URL, a screenshot upload, or pasted text. The app stores only these artifacts; it never calls an external AI API.

**AC-5.4** — Given the app stores artifact text or URLs provided by the student, then the app does NOT generate, validate, or relay any content through an AI model — it is a dumb storage layer only.

**AC-5.5** — Given all 6 L8 milestones are submitted with required artifacts and the parent has attested, then the L8 capstone is marked complete and a "Shipped!" state is shown.

---

### 6. Parent attestation

**As a parent**, I want to formally sign off on my child's completed capstone, so that the completion record reflects my oversight and involvement.

**AC-6.1** — Given all capstone milestones are submitted with their required artifacts, when the parent logs in and views the capstone, then a prominent "Attest & Complete" action is shown. This action is NOT available to the child's kid-login session.

**AC-6.2** — Given the parent taps "Attest & Complete", then a `capstone_attestations` record is created with `parent_id`, `capstone_id`, `attested_at`, and optionally a short free-text note. The capstone's `completed_at` timestamp is set.

**AC-6.3** — Given the attestation is submitted, then the child sees the capstone as "Complete" on their next visit. The parent cannot un-attest via the UI (corrections require support).

**AC-6.4** — Given a child's kid-login session, when they view the capstone page, then the "Attest & Complete" button is not rendered and the attestation endpoint returns 403 if called directly.

---

### 7. Private portfolio

**As a parent or student**, I want to view the completed capstone(s) in a private portfolio, so that we can reflect on what was built without exposing it to others.

**AC-7.1** — Given a completed capstone, when the child or their parent navigates to `/children/[studentId]/portfolio`, then they see the capstone entries (L7 and/or L8) with milestone status, artifact links/previews, rubric answers, and attestation info.

**AC-7.2** — Given an authenticated parent viewing the portfolio, then only capstones belonging to their own child are visible (enforced by RLS: `capstones.student_id in (select id from students where parent_id = auth.uid())`).

**AC-7.3** — Given any other authenticated user (a different parent, a different kid login), when they attempt to access `/children/[studentId]/portfolio` for a student they do not own, then they receive a 404 (not a 403, to avoid confirming the student's existence).

**AC-7.4** — Given the app has no public gallery feature, then no capstone data, artifact URL, or student identifier is ever returned to an unauthenticated request or to a session belonging to a different parent.

---

### 8. Child-safety invariant (explicit AC)

**AC-8.1** — No page, API route, server action, or background job in the app calls an external LLM API (OpenAI, Anthropic, Google, etc.) in response to a student session or student-submitted content.

**AC-8.2** — No student-facing page renders text that was generated at request-time by an AI model. All lesson and quiz content is pre-authored, offline-vetted, and stored as static rows in `passages` / `reading_questions` before being published.

**AC-8.3** — The project kit copy inside the L8 capstone milestones is static text authored offline. It is stored as structured content in the database (or in code), not generated dynamically.

**AC-8.4** — Artifact uploads (screenshots, pasted text) are stored as-is. The app does not analyze, summarize, classify, or relay artifact content through any AI model.

**AC-8.5** — The `reading_questions.correct_index` field for AI course questions must remain service-role-only (RLS on `reading_questions`, no policy), consistent with the existing invariant. The answer is graded server-side; the client receives only `correct: boolean`.

---

## Approved 24-Week Curriculum Outline (content context, not engineering scope)

**AI 7: Foundations (weeks 1–12)**
W1 What is intelligence? · W2 What is AI? · W3 Dreams of thinking machines (automata → Turing) · W4 The birth of AI (Dartmouth 1956) · W5 The AI winters · W6 Rules vs. learning · W7 Data: the fuel of AI · W8 How machines learn · W9 Brains vs. neural nets · W10 What AI is NOT · W11 AI all around you · W12 Strengths & limits (+ brief intro to the AI-free capstone project)

**AI 8: Builds On (weeks 13–24)**
W13 The deep learning boom · W14 How generative AI works · W15 Talking to AI well (prompting, offline) · W16 When AI is wrong (hallucinations) · W17 Bias & fairness · W18 AI ethics · W19 AI, work & creativity · W20 Using AI safely as a teen · W21 How real products get built · W22 Planning a build with AI · W23 Shipping to the world · W24 Launch (+ brief intro to the parent-mediated capstone)

---

## Success Metrics

| Metric | Target (3 months post-launch) |
|---|---|
| Students completing Week 1 of AI 7 who go on to complete Week 4 | >50% |
| Students who complete all 12 AI 7 weeks | >30% of those who started |
| L7 capstone completion rate (among AI 7 completers) | >40% |
| AI 8 unlock rate (among AI 7 completers) | >50% |
| L8 capstone completion rate (among AI 8 completers) | >25% |
| Child-safety violations (live LLM call in a student session) | 0 |
| Capstone data leakage incidents (wrong parent sees another child's portfolio) | 0 |

---

## Open Questions for System Architect and Database

These are genuinely new engineering decisions not resolved by the locked product decisions:

**OQ-1 — Subject discriminator on `passages`.**
The `passages` table has no `subject` column today. AI passages cannot be distinguished from Reading passages by `grade` alone (grades 7–8 do not overlap with the current Reading grade range of 3–5, but that would be a fragile implicit contract). The architect must decide: add `subject text` to `passages` (e.g., `'reading' | 'ai7' | 'ai8'`), or model AI courses as a separate table, or use a join to a new `courses` table. `getReadingPath` queries by `grade`; its signature and query must change if the subject discriminator is added.

**OQ-2 — Cross-level unlock modeling.**
AI 8 unlocking on AI 7 completion is a cross-level prerequisite with no precedent in the current schema. The reading ladder gates within a single `grade` value. Options for the architect to evaluate: (a) a `course_prerequisites` join table referencing a `courses` table; (b) a computed function `is_ai8_unlocked(student_id)` that counts `reading_progress.passed_at` for all AI-7 passage IDs; (c) a denormalized `students.ai7_completed_at` timestamp. The choice affects how the ladder page query works and how the unlock state is cached.

**OQ-3 — Capstone data model details.**
The spec describes `capstones → capstone_milestones → capstone_artifacts` + `capstone_attestations`. The architect must define: primary keys, FK structure, which milestone fields are nullable, how "milestone is complete" is computed (all required artifact types present + `submitted_at` set), and what "required artifact" means (a per-milestone `artifact_schema jsonb` field?). The project kit copy (static instructions/templates for L8) also needs a home — is it a `milestone_content jsonb` column, or hard-coded in the front end?

**OQ-4 — Artifact storage.**
Students upload screenshots and paste links/text as artifacts. Supabase Storage is the natural choice for binary uploads. The architect must define: bucket name, RLS policy (only the student's parent may read), file path convention (e.g., `/{student_id}/{capstone_id}/{milestone_id}/{filename}`), max file size, and accepted MIME types. Pasted text and URLs can be stored as `text` columns on `capstone_artifacts` rather than in Storage.

**OQ-5 — Parent attestation and the auth model.**
Attestation must be parent-only, not child-accessible. The existing `resolveStudent` returns `role: "parent" | "kid"`. The attestation API route must check `access.role === "parent"` and reject kid sessions (AC-6.4). The architect should confirm this check is sufficient and that no kid-login bypass exists in the current `resolveStudent` implementation.

**OQ-6 — Billing / Subject type.**
`billing.ts` defines `Subject = "math" | "reading"`. Adding an AI subject requires a decision: is it a third subject on the "One Subject" plan, a separate plan tier, or always included with an "All" plan? This is a pricing/business decision that must be made before the billing gate can be wired. Engineering can stub the gate as "always unlocked" during build, but the spec cannot finalize this.

**OQ-7 — `getReadingPath` reuse vs. fork.**
The AI course re-uses the Reading engine, but `getReadingPath` is tightly coupled to `student.nominal_grade` as the passage selector. For AI courses, the selector is the subject/course, not the grade. The architect must decide whether to: (a) add a `subject` parameter to `getReadingPath` and adjust its query; (b) write a thin wrapper `getAICoursePath(admin, student, course: 'ai7'|'ai8')` that calls into the same table with a subject filter; or (c) extract a generic `getPassagePath` function. Option (b) is the YAGNI-preferred starting point.

**OQ-8 — Level 8 capstone "project kit" delivery.**
The project kit (prompt templates, checkpoint questions) must reach the child in-app as static content but must NOT be generated by a live LLM. Where does this content live? Options: a `milestone_kit jsonb` column authored offline and stored in the DB, or a static JSON/MDX file in the repo served at build time. The architect should pick the simplest option that still lets content editors update it without a code deploy.

---

## Handoff

Next specialist: **system-architect** — design the data model for AI course subject discrimination, cross-level unlock, and the capstone subsystem (OQ-1 through OQ-8 above), confirm the `getReadingPath` reuse/fork decision, and define the Storage RLS for artifact uploads.
