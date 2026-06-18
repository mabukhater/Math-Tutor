# Unified accounts: one parent, one set of per-child progress, everywhere

**Status:** confirmed against current code (task #10). The web app exists; the
Telegram bot and a native iOS/Android app are planned. This document records the
identity/progress model so that every surface — web, Telegram, native — shares
**one parent account** and **one set of per-child progress**, and a child's
mastery/streaks/placement are identical no matter where they practice.

The whole design rests on a single fact: **there is exactly one Supabase project**,
and **all progress tables are keyed by `student_id`**. Any surface that can resolve
the right `student_id` and reach that project reads and writes the same rows.

---

## 1. Identity model

- **Parent == `auth.users`.** `public.parents.id` is a 1:1 FK to `auth.users(id)`
  (`supabase/migrations/0001_init.sql:48-53`). A parent is a Supabase Auth user;
  there is no separate account system. The row is created idempotently on first
  authenticated visit by `ensureParent` (`web/src/lib/parents.ts:5-9`, called from
  `web/src/app/dashboard/page.tsx:16`).
- **Children == `students` rows owned by a parent.** Each `students` row has
  `parent_id -> parents.id` and a `display_name` (first name/nickname only, to
  minimize PII) (`0001_init.sql:58-71`). **Children have no auth identity** — they
  never log in. A child is just data hanging off the parent.
- **One parent ↔ many children.** `idx_students_parent` and the RLS policies are
  written for the multi-child case; the dashboard lists all of a parent's students
  (`dashboard/page.tsx:18-23`).
- **Telegram is an attribute of a child, not a login.** `students.telegram_chat_id`
  (`bigint unique`, null until linked, `0001_init.sql:66`) ties a Telegram chat to
  exactly one student. It is an additional access channel into the same row, not a
  second account.

## 2. Why progress is automatically shared

Every progress/telemetry table is keyed by `student_id` and lives in the same
project (`0001_init.sql`):

| Table | Key | Holds |
|---|---|---|
| `student_skill_progress` | `(student_id, skill_id)` unique | Leitner box, streak, attempts/correct, `next_due_at` — the mastery state |
| `attempts` | `student_id` | every answer (telemetry) |
| `daily_sessions` | `(student_id, session_date)` unique | daily set + streak/completion |
| `placement_sessions` | `student_id` | placement runs + estimated index |
| `students.current_skill_index`, `placement_completed` | the student row | placement result / ladder position |

Because the mastery state is one `(student_id, skill_id)` row, there is no
per-surface copy to reconcile. When the web answer route grades a question it
upserts `student_skill_progress` on `(student_id, skill_id)` and updates
`daily_sessions` (`web/src/app/api/practice/answer/route.ts:78-96`). A Telegram
bot or native app that resolves the same `student_id` and calls the same logic
writes the same rows. **Sharing is the default; it would take deliberate effort to
make it *not* shared.** The schema header states the intent explicitly: "All
progress writes to the shared DB, so web/Telegram/future-app share one tracked
state" (`docs/STATUS.md:27-31`).

## 3. How each surface authenticates and resolves the current student

The codebase already uses two client types, and this split is the template every
surface follows:

- **Anon / RLS-enforced client** — `createClient` (server:
  `web/src/lib/supabase/server.ts`; browser: `web/src/lib/supabase/client.ts`).
  Uses the anon key + the parent's session cookie. RLS guarantees a parent only
  sees their own `parents`/`students` and child-scoped rows
  (`0001_init.sql:196-228`).
- **Service-role client** — `createAdminClient`
  (`web/src/lib/supabase/admin.ts`). Bypasses RLS, **server only**. Used to read
  the service-role-only `questions` table (so `correct_index` never reaches a
  device), grade answers, and write progress.

The established route pattern: authenticate the parent with the anon client
(`supabase.auth.getUser()`), confirm the student belongs to them by reading
`students` **under RLS**, then do privileged reads/writes with the admin client
(`api/practice/answer/route.ts:17-28`, `api/placement/start/route.ts:11-23`).

### Surface → auth → student resolution → tables touched

| Surface | Auth method | Resolves current student | Tables touched |
|---|---|---|---|
| **Web** (built) | Supabase Auth session **cookie** (anon client via `@supabase/ssr`); middleware refreshes the session and gates `/dashboard`, `/children`, `/placement`, `/practice`, `/vet` (`web/src/middleware.ts:33-39`) | `studentId` from the URL, verified under RLS that `parent_id = auth.uid()` before any write (`api/practice/answer/route.ts:23-28`) | reads `students`, `student_skill_progress`, `attempts`, `daily_sessions`, `placement_sessions` (RLS); privileged writes + `questions` reads via service role |
| **Telegram** (planned, M3) | Account **linking**, not a separate login: parent (already web-authenticated) generates a one-time row in `telegram_link_tokens` (service-role-only, `0001_init.sql:154-160`); the bot exchanges the token to set `students.telegram_chat_id`. The bot **worker** authenticates to Supabase with the **service role** | maps inbound `chat_id` → `students` row via `telegram_chat_id` (unique), giving `student_id` | same progress tables as web, written via service role; reads `questions` |
| **Native iOS/Android** (planned) | Supabase Auth **SDK** (e.g. `supabase-js` / `supabase-swift` / `supabase-kt`) against the **same project** — same parent email login, just a mobile session instead of a cookie | parent picks a child; `student_id` verified under the same RLS policies | identical to web: RLS reads + a server/edge layer using the service role for grading/writes |

The native column is **architecturally already supported**: Supabase Auth issues
sessions to web and mobile from the same `auth.users` table, so a parent logging
into the app is the *same* parent row, seeing the *same* `students` and the *same*
progress. No schema change is required to add the native surface.

## 4. Gaps / to-dos to truly guarantee one-account-everywhere

1. **The Telegram bot worker does not exist.** `bot/` is empty; the link page is a
   placeholder (`web/src/app/children/[studentId]/link/page.tsx` — "built in M3").
   No code yet issues `telegram_link_tokens`, redeems them, sets
   `telegram_chat_id`, or maps `chat_id → student`. M3 is unstarted
   (`docs/STATUS.md:32`). Until built, "shared everywhere" is proven for web only.
2. **Shared grading logic is split between pure functions and HTTP routes.** The
   surface-agnostic core lives in `web/src/lib/practice.ts` / `practiceServer.ts`,
   but the orchestration (auth → grade → upsert) currently lives inside Next.js
   API routes. The Python bot and native app cannot import those routes. To avoid
   drift, either (a) have non-web surfaces call the existing HTTP endpoints, or
   (b) extract the grading/SR contract into a shared service both can call.
   Pick one before M3 so three surfaces don't reimplement the Leitner update.
3. **Native app auth method not yet chosen.** Decide on the Supabase Auth SDK per
   platform and confirm it targets the same project ref (currently
   `gyaprlbdbzbpfulcanfa`, `docs/STATUS.md:11`). No mobile code exists yet.
4. **RLS-vs-service-role consistency must hold for every surface.** Today: parents
   read child rows under RLS; all writes and all `questions` reads go through the
   service role. The bot worker must use the service role the same way, and the
   service-role key must never ship in the native app — privileged writes must go
   through a server/edge layer, not the device.
5. **Linking is the only join between a child and Telegram — protect it.**
   `telegram_chat_id` is `unique`, so one chat ↔ one student is enforced, but token
   generation/expiry/single-use (`telegram_link_tokens.used`, `expires_at`) must be
   honored by the (not-yet-written) worker so a chat can't bind to the wrong child.
6. **One parent ↔ many children ↔ many surfaces** is supported in schema and web,
   but should be verified end-to-end once Telegram/native exist (e.g. two children,
   one on Telegram and one on the app, both reflecting on the parent's dashboard).

## 5. Invariants to preserve

- `parents.id == auth.users.id`; **children never get their own auth identity.**
- **All per-child state is keyed by `student_id`** and lives in **one Supabase
  project**. Never fork progress into a per-surface store or a second database.
- Every surface resolves to a `student_id` owned by the authenticated parent
  (RLS `parent_id = auth.uid()`), or — for the bot — to the unique
  `telegram_chat_id` that points at exactly one student.
- `questions` and `telegram_link_tokens` stay **service-role-only** (RLS on, no
  policies); the service-role key never reaches a browser, a child's device, or a
  shipped native binary.
- `correct_index` is graded server-side and never returned to any client.
- Telegram is an **access channel on a child row**, not an account; linking sets
  `telegram_chat_id`, it does not create a new identity.
