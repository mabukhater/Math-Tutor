-- ============================================================================
-- Reading comprehension: a second subject. Leveled passages, each with numbered
-- paragraphs and multiple-choice comprehension questions. A gated path (read a
-- passage -> answer its questions -> hit the parent pass mark -> unlock the next,
-- harder passage). Every question carries a LOCATOR (the paragraph that holds
-- the answer) so a wrong answer sends the child back into the text.
--
-- Parallel to the math tables; reuses students.pass_threshold as the pass mark.
-- ============================================================================
create table if not exists public.passages (
  id          uuid primary key default gen_random_uuid(),
  grade       int  not null,
  level_order int  not null,            -- difficulty order within the grade
  title       text not null,
  paragraphs  jsonb not null,           -- [{"n":1,"text":"..."}, ...]
  word_count  int,
  status      text not null default 'draft',  -- draft | published | retired
  created_at  timestamptz not null default now(),
  constraint passages_status check (status in ('draft','published','retired'))
);
create index if not exists idx_passages_grade on public.passages (grade, level_order);

-- SERVER-ONLY answer data: RLS on, no policy (service role only) — correct_index
-- and locator must never reach the browser except after an answer is graded.
create table if not exists public.reading_questions (
  id            uuid primary key default gen_random_uuid(),
  passage_id    uuid not null references public.passages(id) on delete cascade,
  stem          text not null,
  options       jsonb not null,
  correct_index int  not null,
  explanation   text not null,
  locator       jsonb not null,         -- {"paragraph":2,"hint":"..."}
  qtype         text,                   -- main_idea | detail | inference | vocab | sequence
  status        text not null default 'draft',
  created_at    timestamptz not null default now(),
  constraint rq_options_array check (jsonb_typeof(options) = 'array'),
  constraint rq_four_options  check (jsonb_array_length(options) = 4),
  constraint rq_correct_index check (correct_index between 0 and 3),
  constraint rq_status        check (status in ('draft','vetted','retired'))
);
create index if not exists idx_reading_q_passage on public.reading_questions (passage_id, status);

create table if not exists public.reading_progress (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.students(id) on delete cascade,
  passage_id     uuid not null references public.passages(id) on delete cascade,
  passed_at      timestamptz,
  total_attempts int  not null default 0,
  total_correct  int  not null default 0,
  unique (student_id, passage_id)
);
create index if not exists idx_reading_prog_student on public.reading_progress (student_id);

create table if not exists public.reading_blocks (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete cascade,
  passage_id    uuid not null references public.passages(id) on delete cascade,
  question_ids  jsonb not null,
  num_completed int  not null default 0,
  num_correct   int  not null default 0,
  passed        boolean,
  threshold     int  not null,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create index if not exists idx_reading_blocks_student
  on public.reading_blocks (student_id, passage_id, created_at desc);

alter table public.passages          enable row level security;
alter table public.reading_questions enable row level security;  -- service role only
alter table public.reading_progress  enable row level security;
alter table public.reading_blocks    enable row level security;

drop policy if exists "published passages readable by authenticated" on public.passages;
create policy "published passages readable by authenticated"
  on public.passages for select to authenticated using (status = 'published');

drop policy if exists "parent reads own reading progress" on public.reading_progress;
create policy "parent reads own reading progress"
  on public.reading_progress for select to authenticated
  using (student_id in (select id from public.students where parent_id = auth.uid()));

drop policy if exists "parent reads own reading blocks" on public.reading_blocks;
create policy "parent reads own reading blocks"
  on public.reading_blocks for select to authenticated
  using (student_id in (select id from public.students where parent_id = auth.uid()));
