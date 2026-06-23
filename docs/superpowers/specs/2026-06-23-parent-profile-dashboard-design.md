# Parent profile, guided onboarding & sidebar dashboard — design

Date: 2026-06-23
Status: approved (structure)

## Goal

Give the parent account "more meat": a real profile (name + address), a guided
onboarding right after signup, age-based grade placement when adding a child, and
a reorganized dashboard — from one big card into an app shell with a left sidebar
(Children / Billing / Account).

## Current state

- **Auth**: `/login` (Supabase email+password). Email confirmation is off, so a new
  parent gets a session immediately and currently lands on `/dashboard`.
- **`parents`**: `id, email, subscription_plan, subscription_subject,
  subscription_status, stripe_customer_id, stripe_subscription_id, created_at`.
  No name/address.
- **`students`** (= children): `display_name, curriculum_id, nominal_grade` (normalized
  1–8), `placement_completed, pass_threshold, year_plan_id`, … No birthdate.
- **Grade model**: `nominal_grade` is a normalized integer; `curricula` rows carry
  `grade_noun` + `grade_offset`; `gradeLabel(noun, offset, grade, code)` renders
  "Grade 4" / "Year 5" / etc.
- **Dashboard**: `web/src/app/dashboard/page.tsx`, one card (`maxWidth 880`),
  `force-dynamic`, renders `BillingControl` + `DashboardViews` + "Add a child".
- **Add child**: `/children/new` (`NewChildForm` + `addChild` server action) collects
  `display_name, curriculum_id, nominal_grade`; places child at the start of the grade.

## Decisions (from brainstorm)

1. **Onboarding**: guided, **skippable** 2-step wizard after first signup.
2. **Grade**: **auto-suggest from birthdate** (Sept 1 school cutoff), parent can override.
3. **Sidebar IA**: **Children / Billing & plan / Account** (no Overview page in v1).

## Data model

`supabase/migrations/0018_parent_profile.sql` (additive only):

```sql
alter table parents
  add column if not exists full_name text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists region text,
  add column if not exists postal_code text,
  add column if not exists country text,
  add column if not exists phone text,
  add column if not exists onboarding_completed boolean not null default false;

alter table students
  add column if not exists birthdate date;
```

Existing RLS (parents self-scoped by `id`, students by `parent_id`) covers the new
columns; no policy changes.

## Grade auto-suggest

Pure, unit-tested helper `web/src/lib/placement.ts`:

- `schoolYearCutoff(today): Date` → the most recent **Sept 1** on/before `today`.
- `suggestGrade(birthdate, today): number` → `clamp(ageOnCutoff − 5, 1, 8)`, where
  `ageOnCutoff` is the child's age at that Sept 1. (Grade 1 ≈ age 6 at the cutoff.)
- Curriculum-agnostic: returns a `nominal_grade`; the UI renders the curriculum's
  label via `gradeLabel`. Parent can still pick any grade 1–8.

UI shows the suggestion preselected: *"Suggested: Grade 4 — you can change this."*

## Onboarding flow (`/welcome`)

After `signUp` returns a session, `/login` routes new accounts to `/welcome/profile`
(instead of `/dashboard`).

- **Step 1 — `/welcome/profile`**: name + address form. "Save & continue" → step 2;
  "Skip for now" → step 2.
- **Step 2 — `/welcome/child`**: child form with `display_name` + `birthdate` +
  curriculum → auto-suggested grade (overridable). "Add child" → `/dashboard`;
  "Skip" → `/dashboard`.
- `parents.onboarding_completed` set `true` when the parent leaves the wizard (either
  step's continue/skip terminal action).
- Persistent nudge: a dismissible "Finish your profile" banner shows on the dashboard
  while `full_name is null`.

## Dashboard app shell

Next.js **route group** `(parent)` with a shared `layout.tsx` providing the sidebar.
URLs are unchanged (a route group adds no path segment).

- **Sidebar**: brand mark; nav (Children / Billing & plan / Account); footer with the
  parent's name + Sign out. Active item via a small client `SidebarNav` using
  `usePathname`.
- **Pages under the shell**:
  - `(parent)/dashboard` — Children view (existing `DashboardViews`, moved into the shell;
    the inline billing bar moves to Billing, replaced by a compact "All Subjects · active"
    chip linking to Billing).
  - `(parent)/billing` — plan/status/subject, Manage billing (Stripe portal), upgrade
    options, $2/additional-child note. (Hosts the current `BillingControl`.)
  - `(parent)/account` — profile form (name, address, phone), read-only email, and
    change-password (`supabase.auth.updateUser`).
- **Responsive**: under ~720px the sidebar collapses to a top horizontal nav.
- **Scope**: the shell wraps dashboard/billing/account in v1. `children/*`, `placement/*`,
  `plan/*`, `practice/*` keep their current chrome with a back link (can adopt the shell
  later). Kid pages (`/learn`, `/reading`, `/me`) are untouched.

## Files

**New**
- `supabase/migrations/0018_parent_profile.sql`
- `web/src/lib/placement.ts` (+ `placement.test.ts`)
- `web/src/app/(parent)/layout.tsx`, `web/src/components/SidebarNav.tsx`
- `web/src/app/(parent)/billing/page.tsx`
- `web/src/app/(parent)/account/page.tsx` (+ `ProfileForm.tsx`, server actions)
- `web/src/app/welcome/profile/page.tsx` (+ form/action)
- `web/src/app/welcome/child/page.tsx`

**Modified**
- `web/src/app/login/page.tsx` — new accounts → `/welcome/profile`
- `web/src/app/dashboard/page.tsx` → moves under `(parent)`, renders inside the shell,
  billing bar → compact chip + "Finish your profile" nudge
- `web/src/app/children/new/NewChildForm.tsx` + `actions.ts` — add `birthdate` and
  consume the suggested grade
- `web/src/lib/parents.ts` — unchanged (`onboarding_completed` defaults false)

## Out of scope (YAGNI)

- No Overview/stats page in v1.
- No separate billing address; one profile address.
- No avatar uploads, no real "classes/sections" beyond grade.
- No change to kid-facing chrome.

## Testing

- **Unit**: `suggestGrade` boundaries — birthdays just before/after Sept 1, clamping at
  grade 1 and grade 8.
- **Manual**: signup → wizard (both continue and skip paths) → land on dashboard; add
  child with birthdate + override; account profile save + password change; billing page;
  sidebar active states; sub-720px responsive nav.
