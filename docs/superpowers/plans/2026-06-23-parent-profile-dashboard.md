# Parent Profile, Onboarding & Sidebar Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real parent profile (name + address), a skippable guided onboarding after signup, birthdate-based grade auto-suggestion when adding a child, and reorganize the parent area into a sidebar app shell (Children / Billing / Account).

**Architecture:** Additive Postgres columns on `parents` and `students`. A pure `agePlacement.ts` helper suggests a grade from birthdate (Sept-1 cutoff). A Next.js route group `(parent)` provides a shared sidebar layout wrapping `/dashboard`, `/billing`, `/account`. A `/welcome` two-step wizard runs after signup. Server actions persist profile + child data through Supabase (RLS, `createClient`).

**Tech Stack:** Next.js 15 App Router (RSC + server actions), React 19, TypeScript, plain CSS (claymorphic vars in `globals.css`), Supabase (Postgres + Auth + RLS), Node built-in test runner (`node --test`).

## Global Constraints

- Plain CSS only (no Tailwind); reuse existing vars: `--green` `#1d9e75`, `--green-deep`, `--line`, `--muted`. Brand mark = white "A" + "+" superscript on `#1d9e75`.
- Server data access: `createClient` from `@/lib/supabase/server` (RLS, user-scoped); `createAdminClient` from `@/lib/supabase/admin` (service role) only when bypassing RLS is required.
- `attempts` timestamp column is `answered_at` (not `created_at`). FKs to `students` are `ON DELETE CASCADE`.
- Grade is a normalized integer 1–8 (`students.nominal_grade`); render with `gradeLabel(noun, offset, grade, code)` from `@/lib/curriculum`. `GRADES = [1..8]`.
- Tests: Node built-in runner only. Pure logic gets `node:test` unit tests; UI/route work has no component harness in this repo — verify via `npm run build` + `npm run lint` + a manual checklist. Do not add a new test framework.
- Migrations apply via psycopg2 from `/tmp` with `/usr/bin/python3`, DSN: `postgresql://postgres.gyaprlbdbzbpfulcanfa:B7cBFJAalOqHsnr1@aws-1-us-east-2.pooler.supabase.com:5432/postgres`.
- Commit after each task. Branch off `main` already in use; push triggers Railway deploy — only push when the user asks.

---

## File Structure

**New**
- `supabase/migrations/0018_parent_profile.sql` — additive columns
- `web/src/lib/agePlacement.ts` — `suggestGrade`, `schoolYearCutoff` (pure)
- `web/src/lib/agePlacement.test.ts` — unit tests
- `web/src/lib/profileActions.ts` — `updateParentProfile`, `finishOnboarding` server actions + `ParentProfile` type
- `web/src/app/(parent)/layout.tsx` — sidebar shell (auth + kid redirect + ensureParent)
- `web/src/components/SidebarNav.tsx` — client nav with active state
- `web/src/app/(parent)/billing/page.tsx` — Billing & plan
- `web/src/app/(parent)/account/page.tsx` + `web/src/app/(parent)/account/ProfileForm.tsx` + `web/src/app/(parent)/account/PasswordForm.tsx`
- `web/src/app/welcome/profile/page.tsx` + `web/src/app/welcome/profile/WelcomeProfileForm.tsx`
- `web/src/app/welcome/child/page.tsx`

**Modified**
- `web/src/app/dashboard/page.tsx` → moves to `web/src/app/(parent)/dashboard/page.tsx`; billing bar becomes a compact chip + "finish your profile" nudge
- `web/src/app/children/new/NewChildForm.tsx` + `web/src/app/children/new/actions.ts` — birthdate + suggested grade + onboarding mode
- `web/src/app/login/page.tsx` — new signups route to `/welcome/profile`
- `web/src/app/globals.css` — sidebar shell styles
- `web/package.json` — `test` script runs all `src/lib/*.test.ts`

---

## Task 1: Database migration — profile + birthdate columns

**Files:**
- Create: `supabase/migrations/0018_parent_profile.sql`

**Interfaces:**
- Produces: `parents.full_name, address_line1, address_line2, city, region, postal_code, country, phone (text)`, `parents.onboarding_completed (bool, default false)`, `students.birthdate (date)`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0018_parent_profile.sql`:

```sql
-- Parent profile (name + address) and onboarding flag; child birthdate.
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

- [ ] **Step 2: Apply the migration**

Write `/tmp/apply_0018.py`:

```python
import psycopg2
DSN = "postgresql://postgres.gyaprlbdbzbpfulcanfa:B7cBFJAalOqHsnr1@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
sql = open("supabase/migrations/0018_parent_profile.sql").read()
conn = psycopg2.connect(DSN); conn.autocommit = True
cur = conn.cursor(); cur.execute(sql)
print("applied 0018")
cur.close(); conn.close()
```

Run: `cd /Users/majedabukhater/Documents/math-tutor-mvp && /usr/bin/python3 /tmp/apply_0018.py`
Expected: `applied 0018`

- [ ] **Step 3: Verify columns exist**

Run:
```bash
/usr/bin/python3 - <<'PY'
import psycopg2
c=psycopg2.connect("postgresql://postgres.gyaprlbdbzbpfulcanfa:B7cBFJAalOqHsnr1@aws-1-us-east-2.pooler.supabase.com:5432/postgres").cursor()
c.execute("select column_name from information_schema.columns where table_name='parents' and column_name in ('full_name','address_line1','onboarding_completed')")
print(sorted(r[0] for r in c.fetchall()))
c.execute("select column_name from information_schema.columns where table_name='students' and column_name='birthdate'")
print([r[0] for r in c.fetchall()])
PY
```
Expected: `['address_line1', 'full_name', 'onboarding_completed']` then `['birthdate']`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0018_parent_profile.sql
git commit -m "DB: parent profile/address + onboarding flag + student birthdate"
```

---

## Task 2: `agePlacement.ts` — suggest grade from birthdate (TDD)

**Files:**
- Create: `web/src/lib/agePlacement.ts`
- Test: `web/src/lib/agePlacement.test.ts`
- Modify: `web/package.json` (test script)

**Interfaces:**
- Produces:
  - `schoolYearCutoff(today: Date): Date` — most recent Sept 1 (UTC) on/before `today`.
  - `suggestGrade(birthdate: Date, today: Date): number` — `clamp(ageAtCutoff - 5, 1, 8)`.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/agePlacement.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { schoolYearCutoff, suggestGrade } from "./agePlacement.ts";

test("schoolYearCutoff returns this year's Sept 1 when today is after it", () => {
  assert.equal(schoolYearCutoff(new Date("2026-10-15")).toISOString(), "2026-09-01T00:00:00.000Z");
});

test("schoolYearCutoff returns last year's Sept 1 when today is before it", () => {
  assert.equal(schoolYearCutoff(new Date("2026-06-23")).toISOString(), "2025-09-01T00:00:00.000Z");
});

test("a child who is 9 at the cutoff is suggested grade 4", () => {
  // born 2016-05-01 -> age 9 at 2025-09-01 (cutoff for 2026-06-23) -> grade 4
  assert.equal(suggestGrade(new Date("2016-05-01"), new Date("2026-06-23")), 4);
});

test("a just-turned-6 child is grade 1; clamps at the low end", () => {
  assert.equal(suggestGrade(new Date("2019-08-01"), new Date("2026-06-23")), 1); // age 6 -> 1
  assert.equal(suggestGrade(new Date("2022-01-01"), new Date("2026-06-23")), 1); // age 3 -> clamp 1
});

test("an older child clamps at grade 8", () => {
  assert.equal(suggestGrade(new Date("2008-01-01"), new Date("2026-06-23")), 8); // age 17 -> clamp 8
});

test("birthday just before vs after the cutoff shifts the grade by one", () => {
  const today = new Date("2026-10-01");
  assert.equal(suggestGrade(new Date("2017-08-31"), today), 4); // turned 9 before 2026-09-01
  assert.equal(suggestGrade(new Date("2017-09-02"), today), 3); // still 8 at 2026-09-01
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && node --test src/lib/agePlacement.test.ts`
Expected: FAIL — cannot find module `./agePlacement.ts`.

- [ ] **Step 3: Write the implementation**

Create `web/src/lib/agePlacement.ts`:

```ts
// Suggest a normalized grade (1-8) from a child's birthdate using a Sept-1
// school-year cutoff. Pure + date-injected so it is deterministic and testable.
// Grade 1 corresponds to roughly age 6 at the cutoff (grade = age - 5).

const MIN_GRADE = 1;
const MAX_GRADE = 8;

/** The most recent September 1 (UTC midnight) on or before `today`. */
export function schoolYearCutoff(today: Date): Date {
  const year = today.getUTCFullYear();
  const thisYearsCutoff = new Date(Date.UTC(year, 8, 1)); // month 8 = September
  if (today.getTime() >= thisYearsCutoff.getTime()) return thisYearsCutoff;
  return new Date(Date.UTC(year - 1, 8, 1));
}

/** Whole years between `birthdate` and `at`. */
function ageAt(birthdate: Date, at: Date): number {
  let age = at.getUTCFullYear() - birthdate.getUTCFullYear();
  const m = at.getUTCMonth() - birthdate.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < birthdate.getUTCDate())) age -= 1;
  return age;
}

/** Suggested normalized grade for a birthdate, clamped to 1-8. */
export function suggestGrade(birthdate: Date, today: Date): number {
  const age = ageAt(birthdate, schoolYearCutoff(today));
  const grade = age - 5;
  return Math.max(MIN_GRADE, Math.min(MAX_GRADE, grade));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && node --test src/lib/agePlacement.test.ts`
Expected: PASS — all 6 tests pass.

- [ ] **Step 5: Broaden the test script**

In `web/package.json`, change the `test` script from `"node --test src/lib/placement.test.ts"` to:

```json
"test": "node --test src/lib/*.test.ts"
```

Run: `cd web && npm test`
Expected: PASS — placement, practice, and agePlacement suites all run green.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/agePlacement.ts web/src/lib/agePlacement.test.ts web/package.json
git commit -m "Add agePlacement: suggest grade from birthdate (Sept-1 cutoff)"
```

---

## Task 3: Add-child form — birthdate + auto-suggested grade

**Files:**
- Modify: `web/src/app/children/new/NewChildForm.tsx`
- Modify: `web/src/app/children/new/actions.ts`

**Interfaces:**
- Consumes: `suggestGrade` (Task 2); `gradeLabel`, `GRADES` (`@/lib/curriculum`).
- Produces: `addChild(formData)` now also reads `birthdate` (optional) and persists `students.birthdate`; accepts hidden `source` field (`"onboarding"` marks `parents.onboarding_completed = true` and redirects to `/dashboard`).

- [ ] **Step 1: Add birthdate + live suggestion to the form**

Replace the body of `web/src/app/children/new/NewChildForm.tsx` so it adds a birthdate input and, when set, preselects the suggested grade. Full file:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { addChild } from "./actions";
import { gradeLabel, GRADES } from "@/lib/curriculum";
import { suggestGrade } from "@/lib/agePlacement";

interface Curr {
  id: string;
  code: string;
  name: string;
  grade_noun: string;
  grade_offset: number;
}

export default function NewChildForm({
  curricula,
  hasError,
  source,
}: {
  curricula: Curr[];
  hasError: boolean;
  source?: "onboarding";
}) {
  const initial = curricula.find((c) => c.code === "common_core")?.id ?? curricula[0]?.id ?? "";
  const [currId, setCurrId] = useState(initial);
  const [birthdate, setBirthdate] = useState("");
  const [grade, setGrade] = useState(3);
  const [touchedGrade, setTouchedGrade] = useState(false);
  const selected = curricula.find((c) => c.id === currId);
  const noun = selected?.grade_noun ?? "Grade";
  const offset = selected?.grade_offset ?? 0;
  const code = selected?.code;

  const suggested = birthdate ? suggestGrade(new Date(birthdate), new Date()) : null;

  function onBirthdate(v: string) {
    setBirthdate(v);
    if (v && !touchedGrade) setGrade(suggestGrade(new Date(v), new Date()));
  }

  return (
    <div className="wrap">
      <div className="card">
        <h1>Add a child</h1>
        <p className="sub">We store a first name or nickname, birthdate, and level.</p>
        <form action={addChild}>
          {source && <input type="hidden" name="source" value={source} />}
          <label htmlFor="display_name">First name or nickname</label>
          <input id="display_name" name="display_name" required maxLength={40} />

          <label htmlFor="birthdate">Birthdate</label>
          <input
            id="birthdate"
            name="birthdate"
            type="date"
            value={birthdate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => onBirthdate(e.target.value)}
          />

          <label htmlFor="curriculum_id">Curriculum</label>
          <select
            id="curriculum_id"
            name="curriculum_id"
            value={currId}
            onChange={(e) => setCurrId(e.target.value)}
          >
            {curricula.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <label htmlFor="nominal_grade">Level</label>
          <select
            id="nominal_grade"
            name="nominal_grade"
            value={grade}
            onChange={(e) => {
              setTouchedGrade(true);
              setGrade(Number(e.target.value));
            }}
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(noun, offset, g, code)}
              </option>
            ))}
          </select>
          {suggested !== null && (
            <p className="muted" style={{ marginTop: "-0.4rem", marginBottom: "0.6rem", fontSize: "0.82rem" }}>
              Suggested from birthdate: <strong>{gradeLabel(noun, offset, suggested, code)}</strong> — you can change this.
            </p>
          )}

          {code === "ontario" && (
            <p className="muted" style={{ marginTop: "-0.2rem", marginBottom: "0.6rem", fontSize: "0.82rem" }}>
              Pick <strong>Grade 4</strong> to follow the full Sept–June Ontario year plan, week by week.
            </p>
          )}

          {hasError && <p className="err">Please enter a name and pick a curriculum and level.</p>}

          <button className="btn" type="submit">Add child</button>
          <p className="muted" style={{ textAlign: "center", marginTop: "0.6rem", fontSize: "0.82rem" }}>
            They’ll start at the beginning of this grade. You can run an optional level check anytime.
          </p>
        </form>
        <p style={{ marginTop: "1rem", textAlign: "center" }}>
          <Link href="/dashboard" className="muted">Back to dashboard</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Persist birthdate + onboarding source in the action**

In `web/src/app/children/new/actions.ts`, (a) read `birthdate` and `source`; (b) include `birthdate` in the insert; (c) when `source === "onboarding"`, set `parents.onboarding_completed = true`. Apply these edits:

Read the extra fields near the top of `addChild` (after `curriculum_id`):

```ts
  const birthdateRaw = String(formData.get("birthdate") ?? "").trim();
  const birthdate = /^\d{4}-\d{2}-\d{2}$/.test(birthdateRaw) ? birthdateRaw : null;
  const source = String(formData.get("source") ?? "");
```

Add `birthdate` to the insert object:

```ts
    .insert({
      parent_id: user.id,
      display_name,
      nominal_grade,
      curriculum_id,
      year_plan_id,
      birthdate,
    })
```

Just before the final `redirect("/dashboard")`, mark onboarding complete when in the wizard:

```ts
  if (source === "onboarding") {
    await supabase.from("parents").update({ onboarding_completed: true }).eq("id", user.id);
  }

  redirect("/dashboard");
```

- [ ] **Step 3: Build + lint**

Run: `cd web && npm run lint && npm run build`
Expected: lint clean; build succeeds (the `/children/new` route compiles).

- [ ] **Step 4: Manual verification**

- On `/children/new`, set a birthdate → the Level dropdown jumps to the suggested grade and the hint shows it.
- Manually changing Level after that stops auto-updates.
- Submitting saves the child; verify `birthdate` persisted:
  ```bash
  /usr/bin/python3 -c "import psycopg2;c=psycopg2.connect('postgresql://postgres.gyaprlbdbzbpfulcanfa:B7cBFJAalOqHsnr1@aws-1-us-east-2.pooler.supabase.com:5432/postgres').cursor();c.execute('select display_name,birthdate from students order by created_at desc limit 1');print(c.fetchone())"
  ```

- [ ] **Step 5: Commit**

```bash
git add web/src/app/children/new/NewChildForm.tsx web/src/app/children/new/actions.ts
git commit -m "Add-child: birthdate input + auto-suggested grade + onboarding source"
```

---

## Task 4: Profile server actions + types

**Files:**
- Create: `web/src/lib/profileActions.ts`

**Interfaces:**
- Consumes: `createClient` (`@/lib/supabase/server`).
- Produces:
  - `type ParentProfile = { full_name, address_line1, address_line2, city, region, postal_code, country, phone: string | null }`
  - `updateParentProfile(formData: FormData): Promise<void>` — server action; upserts the profile fields for the current user; on `formData.get("redirectTo")` it `redirect()`s there, else returns.
  - `finishOnboarding(): Promise<void>` — sets `onboarding_completed = true`, redirects `/dashboard`.

- [ ] **Step 1: Write the actions module**

Create `web/src/lib/profileActions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ParentProfile = {
  full_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
};

const FIELDS: (keyof ParentProfile)[] = [
  "full_name",
  "address_line1",
  "address_line2",
  "city",
  "region",
  "postal_code",
  "country",
  "phone",
];

export async function updateParentProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const patch: Record<string, string | null> = {};
  for (const f of FIELDS) {
    const v = String(formData.get(f) ?? "").trim();
    patch[f] = v.length ? v.slice(0, 200) : null;
  }
  await supabase.from("parents").update(patch).eq("id", user.id);

  const to = String(formData.get("redirectTo") ?? "");
  if (to.startsWith("/")) redirect(to);
}

export async function finishOnboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await supabase.from("parents").update({ onboarding_completed: true }).eq("id", user.id);
  redirect("/dashboard");
}
```

- [ ] **Step 2: Build**

Run: `cd web && npm run build`
Expected: build succeeds (module compiles; no consumers yet).

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/profileActions.ts
git commit -m "Add parent profile server actions (update + finish onboarding)"
```

---

## Task 5: Parent app shell — `(parent)` route group + sidebar

**Files:**
- Create: `web/src/app/(parent)/layout.tsx`
- Create: `web/src/components/SidebarNav.tsx`
- Move: `web/src/app/dashboard/page.tsx` → `web/src/app/(parent)/dashboard/page.tsx`
- Modify: moved dashboard (billing bar → compact chip + profile nudge)
- Modify: `web/src/app/globals.css` (shell styles)

**Interfaces:**
- Consumes: `createClient`, `createAdminClient`, `ensureParent`, `currentKidStudentId`, `isAdminEmail`.
- Produces: shared sidebar chrome for all `(parent)` pages. `SidebarNav` props: `{ parentName: string; email: string }`.

- [ ] **Step 1: Create the client sidebar nav**

Create `web/src/components/SidebarNav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard", label: "Children" },
  { href: "/billing", label: "Billing & plan" },
  { href: "/account", label: "Account" },
];

const Brand = () => (
  <Link href="/dashboard" className="parent-brand">
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="#1d9e75" />
      <text x="12.5" y="20.5" fontFamily="Verdana, system-ui, sans-serif" fontSize="18" fontWeight="bold" fill="#fff" textAnchor="middle">A</text>
      <text x="21.5" y="11.5" fontFamily="Verdana, system-ui, sans-serif" fontSize="10" fontWeight="bold" fill="#fff" textAnchor="middle">+</text>
    </svg>
    Astute
  </Link>
);

export function SidebarNav({ parentName, email }: { parentName: string; email: string }) {
  const pathname = usePathname();
  return (
    <aside className="parent-sidebar">
      <Brand />
      <nav className="parent-nav">
        {ITEMS.map((it) => {
          const on = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link key={it.href} href={it.href} className={on ? "on" : ""}>
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="parent-sidebar-foot">
        <div className="parent-who">
          <div className="parent-who-name">{parentName || "Parent"}</div>
          <div className="parent-who-email">{email}</div>
        </div>
        <form action="/auth/signout" method="post">
          <button className="parent-signout" type="submit">Sign out</button>
        </form>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create the route-group layout (auth + shell)**

Create `web/src/app/(parent)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureParent } from "@/lib/parents";
import { currentKidStudentId } from "@/lib/access";
import { SidebarNav } from "@/components/SidebarNav";

export const dynamic = "force-dynamic";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  if (await currentKidStudentId(supabase, admin)) redirect("/me");
  await ensureParent(supabase, user);

  const { data: parent } = await supabase
    .from("parents")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="parent-shell">
      <SidebarNav parentName={parent?.full_name ?? ""} email={user.email ?? ""} />
      <main className="parent-main">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Move the dashboard into the group and slim it down**

Move the file:

```bash
mkdir -p "web/src/app/(parent)/dashboard"
git mv web/src/app/dashboard/page.tsx "web/src/app/(parent)/dashboard/page.tsx"
```

Then replace its contents with the shell-aware version (auth/kid-redirect/ensureParent now live in the layout; billing bar becomes a chip + profile nudge):

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/adminAuth";
import { gradeLabel } from "@/lib/curriculum";
import { getPathForStudent } from "@/lib/pathServer";
import { getReadingPath } from "@/lib/readingServer";
import { DashboardViews, type Kid } from "@/components/DashboardViews";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function curField(c: any, f: string) {
  return Array.isArray(c) ? c[0]?.[f] : c?.[f];
}

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // layout already guards; satisfies types
  const admin = createAdminClient();

  const { data: billing } = await supabase
    .from("parents")
    .select("subscription_plan, subscription_status, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: students } = await supabase
    .from("students")
    .select(
      "id, display_name, nominal_grade, placement_completed, current_skill_index, pass_threshold, curriculum_id, year_plan_id, curricula(code, name, grade_noun, grade_offset)",
    )
    .order("created_at", { ascending: true });

  const list = students ?? [];
  const ids = list.map((s) => s.id);
  const { data: kidLogins } = ids.length
    ? await admin.from("kid_logins").select("student_id, username").in("student_id", ids)
    : { data: [] };
  const usernameBy = new Map((kidLogins ?? []).map((k) => [k.student_id as string, k.username as string]));

  const summaries = new Map<string, { math: { passed: number; total: number } | null; reading: { passed: number; total: number } }>();
  for (const s of list) {
    const stud = {
      id: s.id,
      curriculum_id: s.curriculum_id,
      nominal_grade: s.nominal_grade,
      current_skill_index: s.current_skill_index,
      pass_threshold: s.pass_threshold,
    };
    let math: { passed: number; total: number } | null = null;
    if (s.placement_completed) {
      const path = await getPathForStudent(admin, stud);
      const weeks = path.months.flatMap((m) => m.weeks);
      math = { passed: weeks.filter((w) => w.status === "passed").length, total: weeks.length };
    }
    const rp = await getReadingPath(admin, stud);
    summaries.set(s.id, { math, reading: { passed: rp.passedPassages, total: rp.totalPassages } });
  }

  const kids: Kid[] = list.map((s) => ({
    id: s.id,
    name: s.display_name,
    grade: s.nominal_grade,
    gradeLabel: gradeLabel(
      curField(s.curricula, "grade_noun"),
      curField(s.curricula, "grade_offset"),
      s.nominal_grade,
      curField(s.curricula, "code"),
    ),
    placement: s.placement_completed,
    yearPlan: !!s.year_plan_id,
    threshold: s.pass_threshold,
    username: usernameBy.get(s.id) ?? null,
    math: summaries.get(s.id)?.math ?? null,
    reading: summaries.get(s.id)?.reading ?? { passed: 0, total: 0 },
  }));

  const plan = billing?.subscription_plan ?? "free";
  const planLabel = plan === "all" ? "All Subjects" : plan === "one" ? "One Subject" : "Free plan";

  return (
    <>
      <div className="parent-page-head">
        <h1 style={{ margin: 0 }}>Your children</h1>
        <Link href="/billing" className="plan-chip">
          {planLabel}
          {billing?.subscription_status ? ` · ${billing.subscription_status}` : ""}
        </Link>
      </div>

      {!billing?.full_name && (
        <Link href="/account" className="profile-nudge">
          Finish setting up your profile →
        </Link>
      )}

      <DashboardViews kids={kids} />

      <Link href="/children/new" className="btn" style={{ marginTop: "1.25rem" }}>
        Add a child
      </Link>

      {isAdminEmail(user.email) && (
        <p style={{ marginTop: "1rem" }}>
          <Link href="/vet" className="muted">Admin · vet questions →</Link>{" "}
          · <Link href="/early/results" className="muted">waitlist results →</Link>
        </p>
      )}
    </>
  );
}
```

- [ ] **Step 4: Add shell styles**

Append to `web/src/app/globals.css`:

```css
/* Parent app shell */
.parent-shell { display: flex; min-height: 100vh; align-items: stretch; }
.parent-sidebar { width: 240px; flex: none; background: #fff; border-right: 1px solid var(--line); padding: 1.25rem 1rem; display: flex; flex-direction: column; gap: 1rem; position: sticky; top: 0; height: 100vh; }
.parent-brand { display: flex; align-items: center; gap: 0.5rem; font-family: var(--font-display); font-weight: 700; font-size: 1.1rem; color: var(--green-deep); text-decoration: none; padding: 0.25rem; }
.parent-nav { display: flex; flex-direction: column; gap: 2px; }
.parent-nav a { display: block; padding: 0.6rem 0.75rem; border-radius: 10px; color: var(--muted); font-weight: 600; text-decoration: none; }
.parent-nav a:hover { background: #f6f6f4; }
.parent-nav a.on { background: #f0faf6; color: var(--green-deep); }
.parent-sidebar-foot { margin-top: auto; border-top: 1px solid var(--line); padding-top: 0.85rem; }
.parent-who-name { font-weight: 600; font-size: 0.9rem; }
.parent-who-email { font-size: 0.78rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; }
.parent-signout { margin-top: 0.5rem; background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.85rem; padding: 0; }
.parent-main { flex: 1; min-width: 0; padding: 2rem; max-width: 940px; }
.parent-page-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
.plan-chip { background: #f0faf6; color: var(--green-deep); border: 1px solid #d7efe6; padding: 0.4rem 0.8rem; border-radius: 99px; font-weight: 600; font-size: 0.85rem; text-decoration: none; }
.profile-nudge { display: block; background: #fff7e6; border: 1px solid #ffe2a8; color: #8a5a00; padding: 0.7rem 0.9rem; border-radius: 12px; margin-bottom: 1rem; text-decoration: none; font-size: 0.9rem; font-weight: 600; }
@media (max-width: 720px) {
  .parent-shell { flex-direction: column; }
  .parent-sidebar { width: auto; height: auto; position: static; border-right: none; border-bottom: 1px solid var(--line); flex-direction: row; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
  .parent-nav { flex-direction: row; flex-wrap: wrap; }
  .parent-sidebar-foot { margin-top: 0; border-top: none; padding-top: 0; margin-left: auto; display: flex; align-items: center; gap: 0.75rem; }
  .parent-main { padding: 1.25rem; }
}
```

- [ ] **Step 5: Build + lint**

Run: `cd web && npm run lint && npm run build`
Expected: clean. Route table shows `/dashboard`, and `/billing` + `/account` will appear after Tasks 6–7. No duplicate-route error (only one `dashboard/page.tsx` exists now, under `(parent)`).

- [ ] **Step 6: Manual verification**

- `/dashboard` renders inside the sidebar; "Children" is highlighted.
- Plan chip shows "All Subjects · active" (your test sub) and links to `/billing` (404 until Task 6 — expected).
- Sign out works from the sidebar.
- Narrow the window < 720px → sidebar collapses to a top bar.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Parent app shell: (parent) route group + sidebar, dashboard moved in"
```

---

## Task 6: Billing page

**Files:**
- Create: `web/src/app/(parent)/billing/page.tsx`

**Interfaces:**
- Consumes: `createClient`, `BillingControl` (`@/components/BillingControl`) with props `{ plan, status, subject }`.

- [ ] **Step 1: Create the billing page**

Create `web/src/app/(parent)/billing/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { BillingControl } from "@/components/BillingControl";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: billing } = await supabase
    .from("parents")
    .select("subscription_plan, subscription_status, subscription_subject")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Billing &amp; plan</h1>
      <BillingControl
        plan={billing?.subscription_plan ?? "free"}
        status={billing?.subscription_status ?? null}
        subject={billing?.subscription_subject ?? null}
      />
      <p className="muted" style={{ marginTop: "1.5rem" }}>
        Your first child is included on any paid plan; each additional child is{" "}
        <strong>$2/month</strong>. Manage or cancel anytime via Manage billing above.
      </p>
    </>
  );
}
```

- [ ] **Step 2: Build + lint**

Run: `cd web && npm run lint && npm run build`
Expected: `/billing` appears in the route table.

- [ ] **Step 3: Manual verification**

- `/billing` shows the plan + Manage billing (Stripe portal opens). Sidebar highlights "Billing & plan".

- [ ] **Step 4: Commit**

```bash
git add "web/src/app/(parent)/billing/page.tsx"
git commit -m "Billing page under parent shell"
```

---

## Task 7: Account page — profile + password

**Files:**
- Create: `web/src/app/(parent)/account/page.tsx`
- Create: `web/src/app/(parent)/account/ProfileForm.tsx`
- Create: `web/src/app/(parent)/account/PasswordForm.tsx`

**Interfaces:**
- Consumes: `createClient`; `updateParentProfile` (Task 4); `ParentProfile` type.

- [ ] **Step 1: Profile form (client, posts to the server action)**

Create `web/src/app/(parent)/account/ProfileForm.tsx`:

```tsx
"use client";

import { updateParentProfile } from "@/lib/profileActions";
import type { ParentProfile } from "@/lib/profileActions";

export function ProfileForm({ profile, email }: { profile: ParentProfile; email: string }) {
  return (
    <form action={updateParentProfile} className="profile-form">
      <label htmlFor="full_name">Full name</label>
      <input id="full_name" name="full_name" defaultValue={profile.full_name ?? ""} maxLength={120} />

      <label>Email</label>
      <input value={email} disabled />

      <label htmlFor="phone">Phone (optional)</label>
      <input id="phone" name="phone" defaultValue={profile.phone ?? ""} maxLength={40} />

      <label htmlFor="address_line1">Address line 1</label>
      <input id="address_line1" name="address_line1" defaultValue={profile.address_line1 ?? ""} maxLength={200} />

      <label htmlFor="address_line2">Address line 2</label>
      <input id="address_line2" name="address_line2" defaultValue={profile.address_line2 ?? ""} maxLength={200} />

      <label htmlFor="city">City</label>
      <input id="city" name="city" defaultValue={profile.city ?? ""} maxLength={120} />

      <label htmlFor="region">State / region</label>
      <input id="region" name="region" defaultValue={profile.region ?? ""} maxLength={120} />

      <label htmlFor="postal_code">Postal code</label>
      <input id="postal_code" name="postal_code" defaultValue={profile.postal_code ?? ""} maxLength={40} />

      <label htmlFor="country">Country</label>
      <input id="country" name="country" defaultValue={profile.country ?? ""} maxLength={120} />

      <button className="btn" type="submit">Save profile</button>
    </form>
  );
}
```

- [ ] **Step 2: Password form (client, Supabase browser client)**

Create `web/src/app/(parent)/account/PasswordForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PasswordForm() {
  const supabase = createClient();
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return setMsg("Use at least 6 characters.");
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    setMsg(error ? error.message : "Password updated.");
    if (!error) setPw("");
  }

  return (
    <form onSubmit={submit} className="profile-form">
      <label htmlFor="new_password">New password</label>
      <input
        id="new_password"
        type="password"
        autoComplete="new-password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
      />
      <button className="btn" type="submit" disabled={busy || !pw}>
        {busy ? "…" : "Update password"}
      </button>
      {msg && <p className={msg === "Password updated." ? "ok-msg" : "err"}>{msg}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Account page (server, loads profile)**

Create `web/src/app/(parent)/account/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import type { ParentProfile } from "@/lib/profileActions";
import { ProfileForm } from "./ProfileForm";
import { PasswordForm } from "./PasswordForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("parents")
    .select("full_name, address_line1, address_line2, city, region, postal_code, country, phone")
    .eq("id", user.id)
    .maybeSingle();

  const profile: ParentProfile = {
    full_name: data?.full_name ?? null,
    address_line1: data?.address_line1 ?? null,
    address_line2: data?.address_line2 ?? null,
    city: data?.city ?? null,
    region: data?.region ?? null,
    postal_code: data?.postal_code ?? null,
    country: data?.country ?? null,
    phone: data?.phone ?? null,
  };

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Account</h1>
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.05rem" }}>Profile</h2>
        <ProfileForm profile={profile} email={user.email ?? ""} />
      </section>
      <section>
        <h2 style={{ fontSize: "1.05rem" }}>Password</h2>
        <PasswordForm />
      </section>
    </>
  );
}
```

- [ ] **Step 4: Form styles**

Append to `web/src/app/globals.css`:

```css
.profile-form { display: flex; flex-direction: column; gap: 0.35rem; max-width: 460px; }
.profile-form label { font-size: 0.85rem; font-weight: 600; margin-top: 0.5rem; }
.profile-form input { padding: 0.6rem 0.7rem; border: 1px solid var(--line); border-radius: 10px; font: inherit; }
.profile-form input:disabled { background: #f6f6f4; color: var(--muted); }
.profile-form .btn { margin-top: 1rem; }
.ok-msg { color: var(--green-deep); font-size: 0.88rem; }
```

(If `.ok-msg` already exists in `globals.css`, skip that rule to avoid a duplicate.)

- [ ] **Step 5: Build + lint**

Run: `cd web && npm run lint && npm run build`
Expected: `/account` appears in the route table; clean.

- [ ] **Step 6: Manual verification**

- `/account` shows the profile form prefilled; saving persists (reload shows values). Email is disabled.
- After saving a name, the dashboard "Finish setting up your profile" nudge disappears and the sidebar shows the name.
- Password update returns "Password updated."

- [ ] **Step 7: Commit**

```bash
git add "web/src/app/(parent)/account"
git commit -m "Account page: parent profile form + change password"
```

---

## Task 8: Guided onboarding wizard + login redirect

**Files:**
- Create: `web/src/app/welcome/profile/page.tsx`
- Create: `web/src/app/welcome/profile/WelcomeProfileForm.tsx`
- Create: `web/src/app/welcome/child/page.tsx`
- Modify: `web/src/app/login/page.tsx`

**Interfaces:**
- Consumes: `updateParentProfile`, `finishOnboarding` (Task 4); `NewChildForm` with `source="onboarding"` (Task 3); `createClient`.

- [ ] **Step 1: Step-1 form (profile, with skip)**

Create `web/src/app/welcome/profile/WelcomeProfileForm.tsx`:

```tsx
"use client";

import Link from "next/link";
import { updateParentProfile } from "@/lib/profileActions";

export function WelcomeProfileForm({ defaultName }: { defaultName: string }) {
  return (
    <form action={updateParentProfile} className="profile-form">
      <input type="hidden" name="redirectTo" value="/welcome/child" />
      <label htmlFor="full_name">Your name</label>
      <input id="full_name" name="full_name" defaultValue={defaultName} maxLength={120} autoFocus />
      <label htmlFor="address_line1">Address line 1</label>
      <input id="address_line1" name="address_line1" maxLength={200} />
      <label htmlFor="city">City</label>
      <input id="city" name="city" maxLength={120} />
      <label htmlFor="region">State / region</label>
      <input id="region" name="region" maxLength={120} />
      <label htmlFor="postal_code">Postal code</label>
      <input id="postal_code" name="postal_code" maxLength={40} />
      <label htmlFor="country">Country</label>
      <input id="country" name="country" maxLength={120} />
      <button className="btn" type="submit">Save &amp; continue</button>
      <p style={{ textAlign: "center", marginTop: "0.6rem" }}>
        <Link href="/welcome/child" className="muted">Skip for now</Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Step-1 page**

Create `web/src/app/welcome/profile/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { WelcomeProfileForm } from "./WelcomeProfileForm";

export const dynamic = "force-dynamic";

export default async function WelcomeProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("parents").select("full_name").eq("id", user.id).maybeSingle();

  return (
    <div className="wrap">
      <div className="card">
        <p className="muted" style={{ fontSize: "0.8rem" }}>Step 1 of 2</p>
        <h1>Welcome — tell us about you</h1>
        <p className="sub">This helps with receipts and keeping your account secure. You can skip and add it later.</p>
        <WelcomeProfileForm defaultName={data?.full_name ?? ""} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Step-2 page (add first child, reuses NewChildForm)**

Create `web/src/app/welcome/child/page.tsx`. It loads curricula (same shape `NewChildForm` expects) and renders it in onboarding mode, plus a Skip button wired to `finishOnboarding`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NewChildForm from "@/app/children/new/NewChildForm";
import { finishOnboarding } from "@/lib/profileActions";

export const dynamic = "force-dynamic";

export default async function WelcomeChild({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: curricula } = await supabase
    .from("curricula")
    .select("id, code, name, grade_noun, grade_offset")
    .order("name");

  return (
    <div>
      <p className="muted" style={{ fontSize: "0.8rem", textAlign: "center", marginTop: "1rem" }}>
        Step 2 of 2
      </p>
      <NewChildForm curricula={curricula ?? []} hasError={error === "1"} source="onboarding" />
      <form action={finishOnboarding} style={{ textAlign: "center", marginTop: "-1rem" }}>
        <button className="muted" type="submit" style={{ background: "none", border: "none", cursor: "pointer" }}>
          Skip — I’ll add a child later
        </button>
      </form>
    </div>
  );
}
```

Note: `NewChildForm` already redirects to `/dashboard` via `addChild`; with `source="onboarding"` the action also flips `onboarding_completed` (Task 3).

- [ ] **Step 4: Route new signups into the wizard**

In `web/src/app/login/page.tsx`, the signup branch currently pushes `/dashboard` when a session is returned. Change that single line to send brand-new accounts to the wizard. Replace:

```tsx
    if (data.session) {
      // Email confirmation is off — they're signed in immediately.
      router.refresh();
      return router.push("/dashboard");
    }
```

with:

```tsx
    if (data.session) {
      // Email confirmation is off — they're signed in immediately; start onboarding.
      router.refresh();
      return router.push("/welcome/profile");
    }
```

(The sign-in branch still goes to `/dashboard`.)

- [ ] **Step 5: Build + lint**

Run: `cd web && npm run lint && npm run build`
Expected: `/welcome/profile` and `/welcome/child` appear; clean.

- [ ] **Step 6: Manual verification**

- Create a brand-new account → lands on `/welcome/profile` (Step 1 of 2).
- "Save & continue" persists name/address → `/welcome/child` (Step 2 of 2).
- Setting a birthdate suggests the grade; "Add child" → `/dashboard` with the child present; `onboarding_completed = true`.
- Re-run: create another account → "Skip for now" → "Skip — I'll add a child later" → lands on `/dashboard`, no child; `onboarding_completed = true`. Verify:
  ```bash
  /usr/bin/python3 -c "import psycopg2;c=psycopg2.connect('postgresql://postgres.gyaprlbdbzbpfulcanfa:B7cBFJAalOqHsnr1@aws-1-us-east-2.pooler.supabase.com:5432/postgres').cursor();c.execute('select email,onboarding_completed,full_name from parents order by created_at desc limit 3');[print(r) for r in c.fetchall()]"
  ```
- Existing account sign-in still goes straight to `/dashboard`.

- [ ] **Step 7: Commit**

```bash
git add "web/src/app/welcome" web/src/app/login/page.tsx
git commit -m "Guided onboarding wizard (/welcome) + route new signups into it"
```

---

## Final verification (after all tasks)

- [ ] `cd web && npm test` — all `node:test` suites pass (placement, practice, agePlacement).
- [ ] `cd web && npm run lint && npm run build` — clean, full route table renders.
- [ ] End-to-end manual: new signup → wizard → dashboard (sidebar) → Billing → Account (save profile, change password) → Add child (birthdate suggests grade). Responsive < 720px.
- [ ] Confirm with the user before pushing (push triggers Railway deploy).

## Self-review notes (author)

- **Spec coverage:** data model (Task 1), grade auto-suggest (Task 2 + 3), onboarding wizard + skip (Task 8), sidebar shell Children/Billing/Account (Tasks 5–7), profile incl. address + password (Tasks 4, 7), birthdate on child (Tasks 1, 3), nudge while `full_name` null (Task 5). All covered.
- **Naming:** `suggestGrade(birthdate, today)` / `schoolYearCutoff(today)` used consistently in Tasks 2–3; `ParentProfile` + `updateParentProfile` + `finishOnboarding` consistent across Tasks 4, 7, 8. `NewChildForm` prop `source?: "onboarding"` consistent in Tasks 3, 8.
- **Collision avoided:** grade helper lives in `agePlacement.ts`, separate from the existing assessment `placement.ts`.
- **No new test framework:** pure logic uses the repo's `node --test`; UI verified via build/lint/manual per repo convention.
