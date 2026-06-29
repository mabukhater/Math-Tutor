# AI Literacy Course — Architecture / ADR

**Slug:** ai-literacy-course
**Date:** 2026-06-27
**Status:** Design — awaiting database + engineering handoff
**Author:** System Architect
**Resolves:** OQ-1 .. OQ-8 from `2026-06-27-ai-literacy-course-design.md`

---

## 0. Context & constraints

We are adding a 24-week, two-level AI literacy course plus a new capstone subsystem to an
existing Next.js 15 (App Router) + Supabase app. The locked product decisions (Reading-engine
reuse, no live LLM to children, parent-only attestation, private portfolio, AI billing out of
scope) are taken as given and not re-litigated here.

Constraints that shaped the decisions below, drawn from the real code:

- **Auth/client split (must preserve everywhere).** Routes create an *anon* server client
  (`createClient()` → `supabase.auth.getUser()`) to identify the caller, and an *admin*
  service-role client (`createAdminClient()`) for privileged reads/writes. RLS exists as a
  defense-in-depth backstop; the app does its own authorization in code via `resolveStudent`.
- **Children have no first-class auth scope under RLS.** `resolveStudent` deliberately uses the
  admin client because "a kid session does not satisfy the parent-scoped RLS." So RLS protects
  the *parent direct-read* surface (portfolio page), while *kid* access is gated entirely in
  app code. This is the existing pattern and we follow it.
- **`reading_questions` is service-role-only (RLS on, no policy).** `correct_index` must never
  reach the browser. AI questions live in the same table, so this invariant carries over for
  free (AC-2.4, AC-8.5).
- **The ladder is computed at request time** in `getReadingPath(admin, student)` — no background
  jobs, no denormalized unlock state. We keep that property for AI (AC-3.2).
- **No Storage usage exists in the repo today.** Artifact upload is genuinely net-new surface;
  there is no prior bucket/RLS convention to match, so we establish one.

Cost/scale: this is MVP volume (small cohort). Every decision favors the smallest schema delta
and request-time computation over caching/denormalization. No new infra services on Railway.

---

## 1. Decisions (OQ-1 .. OQ-8)

### OQ-1 — Subject discriminator on `passages` → **Add a `subject text` column.**

Add `subject text not null default 'reading'` to `passages`, constrained to
`('reading','ai7','ai8')`. AI 7 = `ai7`, AI 8 = `ai8`, everything existing stays `reading`.

- **Why:** Smallest non-fragile change. The spec's own warning — that relying on the grade range
  (3–5 reading vs 7–8 AI) is "a fragile implicit contract" — is correct; a real column makes the
  contract explicit and keeps `getReadingPath`'s existing query shape almost unchanged (swap one
  `.eq("grade", …)` filter for `.eq("subject", …)`).
- **Backfill:** the `default 'reading'` + `not null` backfills every existing row in one statement.
- **Rejected — separate `ai_passages` table:** forces a fork of `reading_questions`,
  `reading_progress`, `reading_blocks`, and every server function. Throws away the entire reuse
  premise of the feature.
- **Rejected — `courses` join table:** real normalization, but YAGNI for exactly two fixed,
  hard-coded levels. Revisit only if a third+ subject or dynamic course catalog appears.
- **Grade stays advisory (AC-1.3):** AI ladders filter on `subject`, NOT on `grade`. `grade`/`week`/
  `level_order` remain only as the *within-course ordering* key (week 1..12 / 13..24). Any student,
  any `nominal_grade`, sees all 12 weeks. This is the mechanical reason AI 7 is not grade-gated.

### OQ-2 — Cross-level unlock (AI7 → AI8) → **Computed at request time; no new table, no denormalized timestamp.**

AI 8 unlock = "all *published* `ai7` passages that have vetted questions are passed for this
student." We compute it inside the AI path builder from data we already load:
`count(distinct ai7 passages with vetted questions) == count(passed ai7 passages)`. The
`getAICoursePath` wrapper (see OQ-7) already fetches the published+vetted passage set and the
student's `reading_progress`; the AI-8 gate is one boolean derived from the AI-7 build, costing
zero extra round-trips when both are evaluated together.

- **Why:** Matches the existing "ladder is computed live at page load" property (AC-3.2 explicitly
  asks for request-time evaluation, no background job). It is also *self-correcting*: if an editor
  publishes a 13th AI-7 passage later, the gate re-tightens automatically — a denormalized
  `ai7_completed_at` would silently go stale.
- **The "all 12" count is data-driven, not the literal `12`.** We never hard-code 12; we count the
  published, vetted `ai7` passages. This keeps content and code decoupled (AC-8.2/8.3 spirit).
- **Rejected — `students.ai7_completed_at` denormalized timestamp:** needs a write path on the
  answer route and goes stale when the published set changes. Adds a consistency bug for no perf
  win at this scale.
- **Rejected — `course_prerequisites` + `courses` tables:** over-modeled for one fixed edge
  (ai7→ai8). Same YAGNI verdict as OQ-1's `courses` rejection.
- **Expose as a small helper** `isAi8Unlocked(admin, student): Promise<boolean>` so the AI-8 page
  and the API can share one definition of "unlocked." Internally it reuses the AI-7 path build.

### OQ-3 — Capstone data model → **Four tables; "complete" is computed, "required artifact" is per-milestone `jsonb`.**

Tables (detailed DDL is the database agent's job; this is the blueprint):

- **`capstones`** — one row per (student, level). `student_id` FK, `level int` (7 or 8),
  `created_at`, `completed_at timestamptz null`. `unique (student_id, level)`. A capstone is
  *created lazily* the first time the child opens it (mirrors `getOrCreateReadingBlock`).
  `completed_at` is set ONLY by the parent attestation action (see OQ-5), never by milestone
  submission.
- **`capstone_milestones`** — the 6-row spine per capstone. `capstone_id` FK, `slug`
  (`idea|plan|build_v1|test_feedback|ship|reflect`), `position int` (1..6), `submitted_at
  timestamptz null`, `rubric jsonb null` (only the Reflect milestone uses this — the 3 Yes/No
  answers, AC-4.5). `unique (capstone_id, slug)`.
- **`capstone_artifacts`** — `milestone_id` FK, `kind text` (`url|text|file`), `url text null`,
  `text text null`, `storage_path text null`, `mime text null`, `created_at`. One milestone may
  have 0..N artifacts.
- **`capstone_attestations`** — `capstone_id` FK (`unique`, one attestation per capstone),
  `parent_id` FK → `auth.users`/`parents.id`, `attested_at`, `note text null`. Insert-only; no UI
  un-attest path (AC-6.3 — corrections go through support).

**Milestone-complete is computed, not stored:** a milestone is "complete" when `submitted_at is
not null` AND the artifacts present satisfy its requirement schema. We do not store a `complete`
boolean (avoids drift, same reasoning as OQ-2).

**"Required artifact" = per-milestone `requirement jsonb`** authored offline (see OQ-8 for where it
lives). Shape:
```
{ "requiresArtifact": true, "allowedKinds": ["file","url","text"], "minCount": 1 }
```
The submit action validates the incoming artifact set against this before allowing
`submitted_at` to be set (AC-4.4). If `requiresArtifact` is false, submit may set `submitted_at`
with no artifact.

**Sequential unlock (AC-4.3):** milestone *N* is "active" iff milestone *N-1* is complete; the
first incomplete milestone is active, the rest locked — the *exact same first-incomplete-wins
algorithm* as `getReadingPath`. We will factor this into the capstone read endpoint.

- **Rejected — artifacts as a `jsonb[]` column on the milestone:** can't enforce per-row RLS on a
  file path, can't index, and conflates binary uploads with structured rows. A real child table is
  cleaner and lets the file-RLS join work (OQ-4).

### OQ-4 — Artifact storage → **One private bucket `capstone-artifacts`; text/URL stay in columns; files in Storage with a path-derived RLS join.**

- **Bucket:** `capstone-artifacts`, **private** (not public). Net-new — no prior convention.
- **Path convention:** `{student_id}/{capstone_id}/{milestone_id}/{uuid}-{filename}`. The leading
  `student_id` segment is what RLS keys on.
- **Storage RLS (parent-read only, AC-7.2/7.4):** a `storage.objects` SELECT policy:
  `bucket_id = 'capstone-artifacts' AND (storage.foldername(name))[1] in (select id::text from
  public.students where parent_id = auth.uid())`. This lets a *parent's* direct/anon client read
  only their own child's files. **Kids never read via Storage RLS** (they have no parent-scoped
  identity); kid reads of their own artifacts go through the app using the admin client + a signed
  URL, gated by `resolveStudent` returning their own student. Uploads/writes are **admin-client
  only** through our upload endpoint (no client-direct writes), so there is no INSERT policy.
- **Text & URL artifacts are columns, not files** (`capstone_artifacts.body_text` / `.url`). Cheaper,
  searchable, and avoids a Storage round-trip for the common paste case (AC-5.3).
- **Limits:** max **10 MB** per file; MIME allow-list **`image/png`, `image/jpeg`, `image/webp`,
  `application/pdf`**. Enforced server-side in the upload endpoint (size + magic-byte/MIME check)
  AND as a bucket-level restriction. Screenshots and a plan-photo are the only expected binaries
  (AC-4.4, AC-5.3).
- **Reads to the browser use short-TTL signed URLs** minted server-side, never public URLs
  (AC-7.4 — no artifact URL leaks to anon or to another parent).

### OQ-5 — Attestation guard → **`access.role === "parent"` on the route IS sufficient. Confirmed, no kid bypass.**

I read `resolveStudent`: it returns `role: "parent"` ONLY when `student.parent_id === user.id`.
The `"kid"` branch requires a matching `kid_logins` row for the *authenticated* user. There is no
code path where a kid session is labeled `"parent"`. So:

- The attestation endpoint resolves the student, then **rejects unless `access.role === "parent"`
  with a 403** (AC-6.1, AC-6.4). A kid calling the endpoint directly resolves as `role: "kid"` and
  gets 403.
- **Defense in depth:** the `capstone_attestations` table is written via the **admin client only**
  (no INSERT RLS policy), so even a leaked kid token can't insert directly.
- The UI hides "Attest & Complete" when `access.role !== "parent"` (AC-6.1), but the *endpoint* is
  the real enforcement point.
- **One sharp edge for the reviewer:** `resolveStudent` uses the admin client for the `students`
  lookup, so it does not itself depend on RLS — every consuming route MUST check the returned
  `role` explicitly. This is correct and matches the answer/reading routes; flagged so review
  verifies the role check is present on the attestation route specifically.

### OQ-6 — Billing / `Subject` type → **Add `"ai"` to the union, stub the gate as always-unlocked, wire-point left as a one-liner.**

- Extend `type Subject = "math" | "reading" | "ai"` in `billing.ts`. This is the *only* billing
  change at build time.
- The AI lesson/block endpoints call a thin local `checkAiGate()` that **returns `{ locked: false }`
  unconditionally** for now, with a `// TODO(billing): replace with checkSubjectGate(admin,
  student, "ai") once AI pricing is decided` marker. We do NOT call `checkSubjectGate("ai")` yet,
  because `checkSubjectGate` maps subject→`*_blocks` table and `hasFullAccess` would need the "ai"
  plan-tier rules that pricing hasn't defined.
- **Why not just call the real gate now:** wiring it requires a pricing decision (`one` plan with
  `subscription_subject='ai'`? bundled in `all`? new tier?) that the spec explicitly defers
  (OQ-6 / Non-Goal). Stubbing keeps the call-site identical so the future swap is one line.
- **Human decision required (flagged):** AI subject pricing/plan mapping before launch billing.
  Does not block this build.

### OQ-7 — `getReadingPath` reuse vs fork → **Thin wrapper `getAICoursePath` (validate the spec author's lean).**

Confirmed: write `getAICoursePath(admin, student, course: 'ai7'|'ai8'): Promise<ReadingPath>` in
`readingServer.ts`. It reuses the *entire* body of the ladder algorithm; the only differences from
`getReadingPath` are (a) filter `passages` by `.eq("subject", course)` instead of
`.eq("grade", student.nominal_grade)`, and (b) for `course==='ai8'`, it first evaluates the
AI-7 prerequisite and returns an empty/locked path with an `unlocked: false` flag if AI-7 isn't
complete.

Implementation note to engineering: rather than copy-paste the ~70-line algorithm, extract the
shared core into a private `buildPathFromPassages(admin, student, passages)` helper that *both*
`getReadingPath` and `getAICoursePath` call after they each fetch their passage set. This is the
"extract a generic core" idea but applied *internally* (no public API churn), getting reuse
without forking the algorithm. The public surface is still just the thin wrapper the spec wanted.

- **Why wrapper over adding a `subject` param to `getReadingPath`:** the cross-level AI-8 gate and
  the "empty path = locked level" semantics don't exist for Reading; bolting an optional param +
  branching onto the public Reading function muddies a stable, widely-called function (dashboard,
  reading page, block route all call it). A separate named entry point is clearer and lower-risk.
- **`getOrCreateReadingBlock` and `markPassagePassed` are reused UNCHANGED** — they key on
  `passage_id`/`student_id` and never look at subject. AI lessons flow through them as-is
  (AC-2.1, AC-2.2). This is the big reuse win.

### OQ-8 — Project-kit delivery → **`content jsonb` column on `capstone_milestones`, authored offline; NOT a code-deploy artifact, NOT LLM-generated.**

The L8 kit copy (instructions, prompt *templates the child copies by hand*, checkpoint questions)
lives in a `content jsonb` column on each milestone row (alongside `requirement jsonb` from OQ-3).
Editors update rows directly (Supabase Studio / a seed migration), no code deploy. The frontend
renders this static structured copy verbatim.

- **Why DB column over a static repo file:** the spec asks for "the simplest option that still lets
  content editors update it without a code deploy" — a `jsonb` column wins on the deploy-free
  requirement. It also keeps milestone copy and its `requirement` schema co-located on one row.
- **Child-safety (AC-8.2/8.3):** this content is *authored offline and stored as static rows*,
  exactly like `passages`. It is read-only to the child (RLS SELECT for published content),
  rendered verbatim, never passed through any model. The reviewer must confirm there is no
  render-time templating that could be mistaken for generation — it is literal copy display.
- **Rejected — hard-code in the React frontend:** requires a code deploy for every editorial tweak;
  also scatters child-facing copy across components instead of the content layer.
- **Where do the 6 milestone rows + their content come from?** A **seed migration** (offline,
  editorial), mirroring how `passages`/`reading_questions` are seeded. When a capstone is lazily
  created for a student, we copy the level's milestone template (slug, position, requirement,
  content) into that capstone's `capstone_milestones` rows. *Follow-up question for database*: copy
  the template per-student vs. join to a shared `capstone_milestone_templates` table at read time.
  My recommendation: **shared template table** (`capstone_milestone_templates` keyed by level+slug)
  read at request time, so an editorial copy fix reaches *all* in-flight students instantly and we
  don't duplicate static copy across thousands of rows. Per-student `capstone_milestones` then only
  hold the *progress* fields (`submitted_at`, `rubric`, artifacts FK). This is a small refinement of
  the OQ-3 shape and is the recommended blueprint — see the schema table.

---

## 2. Component / data-flow picture

**Reused UNCHANGED:**
- `getOrCreateReadingBlock`, `markPassagePassed` — AI lessons use them verbatim.
- The whole `passage → reading_block → quiz → answer` flow and its two API routes
  (`/api/reading/block`, `/api/reading/answer`). They already resolve the student and never branch
  on subject; AI passages flow through them with zero change. (Confirm: the block route's `inPath`
  check calls `getReadingPath`; for AI we either pass through `getAICoursePath` or generalize the
  membership check — see "engineering note" below.)
- `resolveStudent`, the anon/admin client split.

**Wrapped / extended:**
- `getReadingPath` → factor a private `buildPathFromPassages` core; add `getAICoursePath` +
  `isAi8Unlocked` (OQ-2, OQ-7).
- `Subject` union gains `"ai"`; a stubbed `checkAiGate` (OQ-6).

**New:**
- Tables: `capstones`, `capstone_milestones`, `capstone_milestone_templates`,
  `capstone_artifacts`, `capstone_attestations` (OQ-3, OQ-8).
- Storage bucket `capstone-artifacts` (OQ-4).
- AI ladder pages `/ai/[studentId]` (and AI-8 view) reusing the reading-ladder UI.
- Capstone pages `/children/[studentId]/capstone/[level]` and portfolio
  `/children/[studentId]/portfolio`.
- New endpoints: capstone read, milestone submit, artifact upload, parent attest (Section 3).

**Engineering note for the block route:** the existing `/api/reading/block` derives "is this
passage playable" from `getReadingPath` membership. For AI, the cleanest reuse is to make that
route subject-aware: accept an optional `subject` and pick `getReadingPath` vs `getAICoursePath`
for the membership check. Everything downstream (block creation, passage fetch, grading) is
unchanged. This keeps one block/answer code path for both subjects.

---

## 3. API / server-action contracts (new surface)

All endpoints follow the existing convention: anon client to identify caller, `resolveStudent`
for authorization, admin client for privileged work. Status codes match the repo
(`401` no user, `404` not found / not owned, `403` wrong role, `402` billing, `409` state, `400`
bad input).

### 3.1 AI ladder path — `POST /api/ai/path`  (parent OR kid)
- **In:** `{ studentId, course: 'ai7' | 'ai8' }`
- **Out:** `ReadingPath` shape + `{ course, unlocked: boolean, prereqMessage?: string }`. For
  `ai8` when AI-7 incomplete: `unlocked:false`, empty `weeks`, `prereqMessage:"Complete AI 7:
  Foundations first."` (AC-3.1). Course-complete state (AC-2.5) is derivable client-side from
  `passedPassages === totalPassages`.
- **Who:** parent or linked kid (`resolveStudent` non-null).
- **Enforcement:** `resolveStudent` → 404 if not owned. `getAICoursePath` computes `unlocked`
  server-side at load (AC-3.2).

### 3.2 AI lesson block — reuse `POST /api/reading/block`  (parent OR kid)
- **In:** `{ studentId, passageId, subject?: 'ai7'|'ai8' }` (subject added; defaults to reading).
- **Out:** existing block payload (passage text + current question; **never** `correct_index`).
- **Enforcement:** `resolveStudent`; membership via `getAICoursePath` when subject is AI; stubbed
  `checkAiGate` (always unlocked). `reading_questions` RLS keeps answers server-side (AC-2.4/8.5).

### 3.3 AI answer — reuse `POST /api/reading/answer`  (parent OR kid) — **unchanged**
- Grades server-side via admin client, returns `correct: boolean` (+ explanation/locator), calls
  `markPassagePassed` on pass. No change needed for AI (AC-2.2, AC-2.4).

### 3.4 Capstone read — `POST /api/capstone`  (parent OR kid)
- **In:** `{ studentId, level: 7 | 8 }`
- **Out:** `{ capstone: {completedAt}, milestones: [{ slug, position, status:
  'complete'|'active'|'locked', content, requirement, rubric, artifacts: [{kind, url?, text?,
  signedUrl?}] }], canAttest: boolean }`. Lazily creates the `capstones` row on first read.
  Milestone status uses the first-incomplete-wins algorithm (AC-4.3). `canAttest` is true only
  when **all milestones complete AND `access.role === 'parent'` AND not yet attested** (AC-6.1).
  File artifacts return short-TTL **signed URLs** (OQ-4), never raw paths.
- **Who:** parent or linked kid.
- **Enforcement:** `resolveStudent` → 404 if not owned (AC-7.3). Level-7 capstone availability
  gated on AI-7 completion; level-8 on AI-8 completion (reuse the same prereq helpers).

### 3.5 Milestone submit — `POST /api/capstone/milestone`  (parent OR kid)
- **In:** `{ studentId, level, slug, rubric?: {shipped,works,documented: boolean} }`
- **Out:** `{ ok: true, milestone: {slug, status} }` or `409 { error: 'missing_artifact' }` /
  `409 { error: 'locked' }`.
- **Behavior:** validates the milestone is *active* (prior complete), validates the artifact set
  against the milestone `requirement` (AC-4.4), then sets `submitted_at`. For the Reflect
  milestone, stores `rubric` (AC-4.5 — recorded, never blocks). **Does NOT set
  `capstone.completed_at`** — only attestation does.
- **Enforcement:** `resolveStudent` (kid may submit their own work). Ownership via student match.

### 3.6 Artifact upload — `POST /api/capstone/artifact`  (parent OR kid)
- **In (file):** multipart `{ studentId, level, slug, file }`. **In (text/url):** JSON
  `{ studentId, level, slug, kind:'text'|'url', value }`.
- **Out:** `{ artifact: { id, kind, ... } }` or `413 { error:'too_large' }` /
  `415 { error:'bad_type' }`.
- **Behavior:** server-side enforce ≤10 MB and MIME allow-list (OQ-4); upload to
  `capstone-artifacts/{student_id}/{capstone_id}/{milestone_id}/...` via **admin client**; insert
  a `capstone_artifacts` row. Text/URL go straight to columns, no Storage. **No AI call, no
  analysis** — dumb storage (AC-5.4, AC-8.4).
- **Enforcement:** `resolveStudent`; the path's leading `student_id` is taken from the resolved
  student, NOT from client input (prevents cross-student writes).

### 3.7 Parent attestation — `POST /api/capstone/attest`  (**parent ONLY**)
- **In:** `{ studentId, level, note?: string }`
- **Out:** `{ ok: true, completedAt }` or `403 { error: 'parent_only' }`.
- **Behavior:** verify `access.role === 'parent'` (else 403, AC-6.4); verify all milestones
  complete (else 409); insert one `capstone_attestations` row (admin client) and set
  `capstone.completed_at` (AC-6.2). Idempotent-ish: second attest → 409 (already complete).
- **Enforcement:** the role check is the gate (OQ-5). No INSERT RLS on the table → kid token can't
  bypass even directly.

### 3.8 Portfolio — page `GET /children/[studentId]/portfolio`  (parent OR kid, own student only)
- Server component. `resolveStudent` → `notFound()` (404, not 403) if caller doesn't own the
  student (AC-7.3). Renders completed capstones with milestones, artifacts (signed URLs), rubric,
  attestation. Belt-and-suspenders: RLS on `capstones`/children also restricts the parent
  direct-read surface (AC-7.2/7.4).

---

## 4. New tables / columns / buckets (blueprint — DDL is the database agent's job)

| Object | Type | Key columns | Notes |
|---|---|---|---|
| `passages.subject` | column | `text not null default 'reading'` | check `('reading','ai7','ai8')`; backfills existing rows; index `(subject, week, level_order)` |
| `Subject` (TS) | type | add `'ai'` | `billing.ts`; stub gate only |
| `capstone_milestone_templates` | table | `level int, slug text, position int, requirement jsonb, content jsonb` | offline-seeded static copy/kit (OQ-8); `unique(level, slug)` |
| `capstones` | table | `id pk, student_id fk, level int, created_at, completed_at null` | `unique(student_id, level)`; lazily created; `completed_at` set only by attest |
| `capstone_milestones` | table | `id pk, capstone_id fk, slug, position, submitted_at null, rubric jsonb null` | progress only; joins template for content/requirement; `unique(capstone_id, slug)` |
| `capstone_artifacts` | table | `id pk, milestone_id fk, kind, url null, text null, storage_path null, mime null, created_at` | text/url in columns; files in Storage |
| `capstone_attestations` | table | `id pk, capstone_id fk unique, parent_id fk, attested_at, note null` | insert-only; admin-client writes |
| `capstone-artifacts` | Storage bucket | private | path `{student_id}/{capstone_id}/{milestone_id}/...`; 10MB; png/jpeg/webp/pdf |

**RLS blueprint (database agent writes the SQL):**
- `passages`: existing "published readable by authenticated" policy already covers AI passages
  (they're just rows with `subject in ('ai7','ai8')`). No new passage policy needed.
- `capstones`, `capstone_milestones`, `capstone_artifacts`, `capstone_attestations`,
  `capstone_milestone_templates`: enable RLS. Parent-read SELECT policies keyed via
  `student_id in (select id from students where parent_id = auth.uid())` (join through
  `capstone_id`/`milestone_id` for the child tables) — same shape as the existing
  `reading_progress`/`reading_blocks`/`kid_logins` policies. Templates: SELECT to authenticated
  (static published copy). **No INSERT/UPDATE policies** — all writes go through the admin client
  in our endpoints (matches the existing reading-write pattern).
- `storage.objects` SELECT policy for bucket `capstone-artifacts` keyed on
  `(storage.foldername(name))[1]` = an owned student id (OQ-4). No INSERT policy (admin writes).

---

## 5. Child-safety & privacy enforcement map (for the reviewer)

| AC | Where enforced in this architecture |
|---|---|
| AC-1.4 / AC-8.1 / AC-8.2 | AI content is static `passages`/`reading_questions` rows. No endpoint calls an external LLM. Reviewer: grep all new routes for any model SDK import — must be zero. |
| AC-2.4 / AC-8.5 | `reading_questions` RLS = on, no policy → `correct_index` only readable via admin client; answer route returns `correct: boolean`. Unchanged for AI. |
| AC-3.1 / AC-3.2 | AI-8 `unlocked` computed server-side in `getAICoursePath`/`isAi8Unlocked` at request time; no client trust, no background job. |
| AC-4.4 | Milestone-submit validates artifact set vs `requirement jsonb` before setting `submitted_at`. |
| AC-5.4 / AC-8.4 | Artifact upload endpoint is dumb storage: size/MIME check, store, insert row. No analysis/relay. Reviewer: confirm no transform of artifact bytes/text. |
| AC-8.3 / OQ-8 | L8 kit copy is static `content jsonb` from `capstone_milestone_templates`, rendered verbatim. Reviewer: confirm no request-time templating that synthesizes copy. |
| AC-6.1 / AC-6.4 / OQ-5 | Attest endpoint requires `access.role === 'parent'` → 403 for kid; table has no INSERT RLS (no direct-token bypass). |
| AC-7.2 / AC-7.3 / AC-7.4 | Portfolio + capstone reads gate via `resolveStudent` (404 on non-ownership, not 403); RLS on capstone tables + Storage backstops the parent direct-read surface; file reads via short-TTL signed URLs only (no public URLs). |

---

## 6. Risks, non-goals, follow-ups

**Risks / human decisions to flag:**
- **AI subject pricing (OQ-6)** is a business decision required before launch billing. Build ships
  with an always-unlocked stub; the swap is one line but the *decision* is a blocker for monetizing.
- **Storage is net-new** — no existing bucket/RLS to copy. The `storage.foldername` RLS join and
  signed-URL discipline are the highest-risk privacy surface (AC-7.4). Security review recommended
  specifically on the bucket policy and the upload path-from-resolved-student (not from client).
- **Kid Storage reads** can't use parent-scoped Storage RLS; kids read their own artifacts only via
  app-minted signed URLs. Reviewer must confirm no path leaks a raw/public URL to a kid session of
  *another* student (blocked by `resolveStudent`, but worth an explicit check).

**Non-goals (restated, do not build):** public gallery / cross-account visibility; human grading or
moderation; any external-AI integration or consent-record storage; AI billing tier; authoring the
24 passages/quizzes or the capstone kit copy (editorial/offline).

**Follow-ups (post-MVP, not launch blockers):**
- Generalize `passages.subject` into a real `courses` catalog only if a 3rd subject/dynamic catalog
  appears (OQ-1/OQ-2 rejections).
- Reconsider denormalizing AI-8 unlock if request-time cost ever shows up at scale (it won't at MVP
  volume).
- Per-student milestone template *copy* vs shared template read (OQ-8) — recommended shared table;
  database agent to confirm and finalize.

---

## 7. Handoff

**Next:** `database` — turn Section 4 into migrations: the `passages.subject` column + backfill +
index; the five capstone tables; the `capstone-artifacts` bucket; and all RLS policies (parent-read
SELECT only, no INSERT policies, Storage `foldername` policy), matching the existing
`reading_progress`/`reading_blocks`/`kid_logins` policy style. Then `software-engineer` for the
`buildPathFromPassages` refactor + `getAICoursePath`/`isAi8Unlocked`, the subject-aware block route,
the four new capstone endpoints, and the ladder/capstone/portfolio pages. Finally `reviewer` +
`security` (auth/privacy/Storage surface) before done.
