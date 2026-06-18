-- ============================================================================
-- Curriculum learning path: a linear, mastery-gated sequence that replaces the
-- adaptive daily feed.
--
--   Topic = month, Skill = week. Each week is: a lesson, then a block of ~20
--   questions. The child passes the week (and unlocks the next) only when their
--   block score reaches the parent-set threshold; otherwise they get another
--   block. Placement still sets the starting point (students.current_skill_index).
-- ============================================================================

-- Parent-adjustable pass mark per child (percent).
alter table public.students
  add column if not exists pass_threshold int not null default 80;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'students_pass_threshold') then
    alter table public.students
      add constraint students_pass_threshold check (pass_threshold between 50 and 100);
  end if;
end $$;

-- A skill (week) is "passed" once a block clears the threshold.
alter table public.student_skill_progress
  add column if not exists passed_at timestamptz;

-- Per-skill weekly lessons (Phase 2 fills these). Existing topic-level lessons
-- keep skill_id null and act as the month intro.
alter table public.lessons
  add column if not exists skill_id uuid references public.skills(id) on delete cascade;

-- Re-key uniqueness: one lesson per skill (skill lessons), and keep one
-- topic-level lesson per (curriculum, topic, grade) for the month intro.
alter table public.lessons drop constraint if exists lessons_curriculum_id_topic_id_grade_key;
create unique index if not exists lessons_skill_unique
  on public.lessons (skill_id) where skill_id is not null;
create unique index if not exists lessons_topic_unique
  on public.lessons (curriculum_id, topic_id, grade) where skill_id is null;

-- In-progress / completed question blocks for the path.
create table if not exists public.path_blocks (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete cascade,
  skill_id      uuid not null references public.skills(id)   on delete cascade,
  question_ids  jsonb not null,
  num_completed int  not null default 0,
  num_correct   int  not null default 0,
  passed        boolean,                      -- null = in progress
  threshold     int  not null,                -- snapshot of the pass mark used
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists idx_path_blocks_student
  on public.path_blocks (student_id, skill_id, created_at desc);

alter table public.path_blocks enable row level security;

drop policy if exists "parent reads own path blocks" on public.path_blocks;
create policy "parent reads own path blocks"
  on public.path_blocks for select to authenticated
  using (student_id in (select id from public.students where parent_id = auth.uid()));
