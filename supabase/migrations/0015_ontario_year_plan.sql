-- ============================================================================
-- Ontario Grade-4 year plan. Ontario as a curriculum; a calendar layer that
-- schedules existing content (math skills + reading passages) across the school
-- year (Sept-June), plus the Ontario expectations for coverage tracking.
-- Reuses the math ladder (per-curriculum) and grade-based reading passages.
-- ============================================================================
insert into public.curricula (code, name, grade_noun, grade_offset)
values ('ontario', 'Ontario Curriculum', 'Grade', 0)
on conflict (code) do update set name = excluded.name;

-- Ontario curriculum expectations (for the coverage view).
create table if not exists public.expectations (
  id            uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  grade         int  not null,
  subject       text not null,            -- 'math' | 'language'
  strand        text not null,            -- 'B. Number'
  code          text not null,            -- 'B1.1'
  description   text not null,
  sort_order    int  not null default 0,
  unique (curriculum_id, grade, subject, code)
);
alter table public.expectations enable row level security;
drop policy if exists "expectations readable by authenticated" on public.expectations;
create policy "expectations readable by authenticated"
  on public.expectations for select to authenticated using (true);

-- A planned school year for a (curriculum, grade).
create table if not exists public.year_plans (
  id            uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  grade         int  not null,
  year_label    text not null,            -- '2025-26'
  start_date    date not null,            -- first teaching day of September
  num_weeks     int  not null,
  unique (curriculum_id, grade, year_label)
);
alter table public.year_plans enable row level security;
drop policy if exists "year_plans readable by authenticated" on public.year_plans;
create policy "year_plans readable by authenticated"
  on public.year_plans for select to authenticated using (true);

create table if not exists public.plan_weeks (
  id           uuid primary key default gen_random_uuid(),
  year_plan_id uuid not null references public.year_plans(id) on delete cascade,
  week_no      int  not null,
  start_date   date not null,
  title        text not null,
  unique (year_plan_id, week_no)
);
alter table public.plan_weeks enable row level security;
drop policy if exists "plan_weeks readable by authenticated" on public.plan_weeks;
create policy "plan_weeks readable by authenticated"
  on public.plan_weeks for select to authenticated using (true);

-- What a week contains, across subjects. ref_id points into skills or passages.
create table if not exists public.plan_items (
  id               uuid primary key default gen_random_uuid(),
  plan_week_id     uuid not null references public.plan_weeks(id) on delete cascade,
  subject          text not null,         -- 'math' | 'language'
  kind             text not null,         -- 'math_skill' | 'reading_passage'
  ref_id           uuid not null,         -- skill_id or passage_id
  title            text not null,
  expectation_codes text[] not null default '{}',
  sort_order       int  not null default 0
);
create index if not exists idx_plan_items_week on public.plan_items (plan_week_id, sort_order);
alter table public.plan_items enable row level security;
drop policy if exists "plan_items readable by authenticated" on public.plan_items;
create policy "plan_items readable by authenticated"
  on public.plan_items for select to authenticated using (true);

-- Enrollment: a student following a year plan.
alter table public.students
  add column if not exists year_plan_id uuid references public.year_plans(id);
