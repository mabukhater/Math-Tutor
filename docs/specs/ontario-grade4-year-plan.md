# Spec — Ontario Grade-4 Year Plan (MVP)

Status: draft for review · Date: 2026-06-22

## 1. Goal

Offer a **complete, week-by-week Grade-4 plan aligned to the Ontario curriculum**, scheduled across the school year (September → June), so a parent can see the whole year laid out and trust the curriculum will be covered. Deliver it by **reusing Kareem's existing lesson → practice → mastery-gate ladder**, with a thin "school-year calendar" layer on top — not a rebuild.

This is the smallest version that proves appetite for a "full local-curriculum year plan," before expanding to more subjects/grades/jurisdictions.

## 2. Scope

### In scope (MVP)
- **One jurisdiction:** Ontario.
- **One grade:** Grade 4.
- **Two subjects:** **Math** and **Language** (reading comprehension + light writing).
- **Full school year:** ~36 teaching weeks, Sept → June, calendar-anchored.
- **Year-plan view:** a timeline/calendar of weeks; current week highlighted; per-subject pace ("on track / behind / ahead").
- **Coverage view:** the list of Ontario Grade-4 expectations with which week covers each (so a parent sees "the year is covered").
- Math + reading remain **auto-graded and mastery-gated**. Writing is delivered as **weekly prompts the parent marks reviewed** (no auto-grading).

### Out of scope (MVP — later phases)
- Science, Social Studies, the Arts, Health/PE (Phase 2: deliver as read-a-lesson + a few questions, not full ladders).
- Other Ontario grades (1–3, 5–8).
- Auto-grading of writing.
- Replacing the existing adaptive ladders for US/UK/Singapore (those stay as-is).

## 3. How it maps onto what we already have

| Need | Reuse |
|------|-------|
| Ontario as a curriculum | Add `ontario` row to `curricula` (existing) |
| Math content | Existing `skills` + `questions` + `lessons` ladder (new Ontario G4 skills) |
| Language / reading | Existing `passages` + `reading_questions` (Grade 4) |
| Lesson → 20-Q gated block | Existing `path_blocks` / mastery engine |
| Reading weekly ladder | Existing `reading_blocks` / weeks |
| Kid + parent logins, pass-mark | Existing `kid_logins`, `students.pass_threshold` |

The genuinely **new** pieces are: a curriculum-expectations table, a year-plan/calendar layer that schedules existing content across Sept–June, and writing prompts.

## 4. Architecture

### 4.1 New tables

```
curricula                       -- add row: code='ontario', name='Ontario Curriculum', grade_noun='Grade', grade_offset=0

expectations                    -- the Ontario curriculum expectations (for coverage)
  id, curriculum_id, grade, subject ('math'|'language'),
  strand,            -- e.g. 'B. Number', 'Reading'
  code,              -- e.g. 'B1.1'
  description, sort_order

year_plans                      -- one planned school year for a (curriculum, grade)
  id, curriculum_id, grade,
  year_label,        -- '2025–26'
  start_date,        -- first teaching Monday of September
  num_weeks          -- ~36

plan_weeks                      -- the Sept–June schedule
  id, year_plan_id, week_no (1..N), start_date, title  -- e.g. 'Week 6 · Multiplication facts'

plan_items                      -- what a week contains, across subjects
  id, plan_week_id, subject, kind ('math_skill'|'reading_passage'|'writing'),
  ref_id,            -- skill_id / passage_id / writing_prompt id (null for writing inline)
  title, expectation_codes text[]   -- which Ontario expectations this item covers

writing_prompts                 -- weekly writing tasks (parent-reviewed)
  id, plan_week_id, prompt, guidance

writing_submissions
  id, student_id, writing_prompt_id, text, parent_reviewed bool, parent_note, updated_at
```

Auto-graded progress reuses `student_skill_progress` (math) and `reading_progress` (language). A week's completion is **derived**: all its `plan_items` done (math skill passed / passage passed / writing parent-reviewed).

### 4.2 Enrollment & mode

A student is **enrolled in a year plan** (new field on `students`, e.g. `year_plan_id`). When enrolled:
- The student follows the **fixed Sept–June week sequence** (no adaptive placement — the whole year is the scope).
- **Mastery still gates within the sequence**: they advance week to week as they pass each week's gated items.
- This is a distinct mode from the current adaptive ladder. US/UK/Singapore students keep the adaptive ladder; Ontario G4 uses the year plan.

### 4.3 Pacing policy (calendar = guide rail, mastery = gate)

- **Expected week** = `floor((today − start_date) / 7) + 1`, clamped to [1, num_weeks].
- **Completed week** = how far the student has actually finished.
- Per subject, show **on track / behind by N / ahead by N**. The calendar never *blocks* by date — a kid behind in October just sees "2 weeks behind, let's catch up." Mastery gating is the only hard lock.

## 5. Content generation (the heavy part — API)

Reuse the existing generators, add an Ontario authoring + scheduling step:
1. **Ontario expectations** (Math: strands B Number, C Algebra, D Data, E Spatial Sense, F Financial Literacy; Language: Oral, Reading, Writing, Media) — author/seed the expectation list (small, mostly hand-curated from the public Ontario curriculum).
2. **Ontario G4 Math skills** mapped to expectations → `skills` (+ topic mapping) → `generate_questions.py` for 20 each.
3. **Ontario G4 Language passages** → `generate_passages.py` (Grade 4) + comprehension; **writing prompts** per week.
4. **Per-skill lessons** → `generate_skill_lessons.py`.
5. **The schedule**: a generation/curation step that sequences skills + passages across ~36 weeks, tags each `plan_item` with expectation codes, and produces `year_plans` / `plan_weeks` / `plan_items`. Output is **human-reviewed** before publish (guardrail: children only see reviewed content).

Cost note: this is a large run (a full grade's math + language for the year). Budget credits accordingly; generate Math first, then Language, then schedule.

## 6. UI

- **`/plan/[studentId]`** — the year plan: a Sept→June timeline (month headers, week rows), current week highlighted, a **pace badge per subject**. Tapping a week expands its `plan_items`, each linking into the existing runners (math block, reading passage, writing prompt). Reuses the claymorphic ladder styling.
- **Coverage view** (parent) — Ontario expectations checklist: covered (✓, with the week) / not yet. The "is the curriculum covered?" answer.
- **Writing** — kid writes into a simple textarea, submits; parent sees it on the dashboard and marks **reviewed** (+ optional note).
- Kid home (`/me`) for an enrolled student points to the **year plan** as the primary surface (instead of separate Math/Reading ladders), with the same progress rings.

## 7. Phasing

- **Phase 1 (this spec):** schema + Ontario curriculum + expectations (Math + Language) + Ontario G4 Math ladder & questions + Grade-4 reading + writing prompts + the year-plan calendar UI + pace + coverage view. Enrollment mode.
- **Phase 2:** Science + Social Studies as read-a-lesson + quiz; more grades; richer coverage analytics; export/print the year plan.

## 8. Open questions (decide before build)

1. **MVP subjects = Math + Language only?** (recommended yes)
2. **Year-plan mode bypasses adaptive placement** (fixed Sept–June start at Week 1)? (recommended yes — it's the "full curriculum" promise)
3. **School-year dates:** ship a default Ontario 2025–26 calendar, let a family shift the `start_date`? (recommended yes)
4. **Writing = parent-reviewed** (not auto-graded) for MVP? (recommended yes)
5. **Positioning:** does Ontario sit alongside US/UK/Singapore as "just another curriculum," or is the year-plan a separate product surface? (recommended: same `curricula` table, but a distinct "Year Plan" mode/UI)

## 9. Testing

- Unit: pace computation (expected vs completed week), week-completion derivation, expectation-coverage rollup (every expectation maps to ≥1 plan_item; flag gaps).
- Data: every `plan_item` ref resolves to live content; every week has items for each in-scope subject; coverage has no gaps.
- E2E (manual): enroll a test Grade-4 student → year plan renders Sept–June → complete a week's math + reading + writing → next week unlocks → pace updates.

## 10. Strategic note

This is a **fork** from the multi-curriculum *mobility* angle toward a *complete local year-plan*. Recommend adding a third headline to the `/early` A/B test ("your child's full Ontario year, planned week by week") to read demand **before** funding the full content generation.
