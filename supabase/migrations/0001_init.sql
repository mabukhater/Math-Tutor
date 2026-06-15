-- ============================================================================
-- Math Tutor MVP — initial schema, RLS, indexes, and reference seed
-- Apply to a DEDICATED Supabase project (NOT shared with any other product).
--
--   supabase db push            # if using the CLI with this file as a migration
--   -- or paste into the SQL editor / apply via MCP apply_migration
--
-- Design notes:
--  * parents.id == auth.users.id (1:1 with Supabase Auth).
--  * Children (students) are rows owned by a parent; they have NO auth identity.
--  * RLS: a parent can read/write ONLY their own children's rows.
--  * Sensitive / server-only tables (questions, telegram_link_tokens) have RLS
--    enabled with NO policies => reachable only via the service role (bot worker,
--    generator, and server-side web routes). Never expose the service role key
--    to the browser. correct_index must never reach a child's device.
-- ============================================================================

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Reference: curricula
-- ----------------------------------------------------------------------------
create table public.curricula (
  id   uuid primary key default gen_random_uuid(),
  code text unique not null,            -- 'common_core'
  name text not null                    -- 'US Common Core'
);

-- ----------------------------------------------------------------------------
-- Reference: skills (the curriculum content graph as a 1D ladder)
-- ----------------------------------------------------------------------------
create table public.skills (
  id                uuid primary key default gen_random_uuid(),
  curriculum_id     uuid not null references public.curricula(id) on delete cascade,
  code              text not null,          -- 'CCSS.3.NF.A.1'
  name              text not null,          -- 'Understand fractions as parts of a whole'
  domain            text,                   -- strand
  grade             int  not null,
  sequence_position int  not null,          -- GLOBAL monotonic order across grades 3->5
  prerequisite_ids  uuid[] not null default '{}',
  unique (curriculum_id, code),
  unique (curriculum_id, sequence_position)
);

-- ----------------------------------------------------------------------------
-- Accounts: parents (== auth.users)
-- ----------------------------------------------------------------------------
create table public.parents (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text unique not null,
  subscription_status text not null default 'trial',  -- trial | active | canceled (stub)
  created_at          timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Children: students (owned by a parent; no independent auth)
-- ----------------------------------------------------------------------------
create table public.students (
  id                  uuid primary key default gen_random_uuid(),
  parent_id           uuid not null references public.parents(id) on delete cascade,
  display_name        text not null,           -- first name / nickname ONLY (minimize PII)
  curriculum_id       uuid references public.curricula(id),
  nominal_grade       int  not null,           -- 3..5 for v1
  placement_completed boolean not null default false,
  current_skill_index int,                      -- position in the ordered skill ladder
  telegram_chat_id    bigint unique,            -- null until linked
  questions_per_day   int  not null default 10,
  timezone            text not null default 'UTC',
  paused              boolean not null default false,
  created_at          timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Question bank (SERVER-ONLY: RLS enabled, no policies => service role only)
-- ----------------------------------------------------------------------------
create table public.questions (
  id            uuid primary key default gen_random_uuid(),
  skill_id      uuid not null references public.skills(id) on delete cascade,
  stem          text not null,
  options       jsonb not null,                 -- ["12","15","9","20"] (exactly 4)
  correct_index int  not null,                  -- 0-based index into options
  explanation   text not null,
  difficulty    int  not null,                  -- 1..5 within the skill
  status        text not null default 'draft',  -- draft | vetted | retired
  source        text not null default 'ai_generated',
  created_at    timestamptz not null default now(),
  constraint questions_options_is_array check (jsonb_typeof(options) = 'array'),
  constraint questions_four_options    check (jsonb_array_length(options) = 4),
  constraint questions_correct_index   check (correct_index between 0 and 3),
  constraint questions_difficulty      check (difficulty between 1 and 5),
  constraint questions_status          check (status in ('draft','vetted','retired'))
);

-- ----------------------------------------------------------------------------
-- Per-student mastery state (Leitner) — service role writes; parent reads own
-- ----------------------------------------------------------------------------
create table public.student_skill_progress (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.students(id) on delete cascade,
  skill_id       uuid not null references public.skills(id) on delete cascade,
  box            int  not null default 0,        -- Leitner box 0..5 (5 = mastered)
  correct_streak int  not null default 0,
  total_attempts int  not null default 0,
  total_correct  int  not null default 0,
  last_seen_at   timestamptz,
  next_due_at    timestamptz,
  unique (student_id, skill_id),
  constraint ssp_box check (box between 0 and 5)
);

-- ----------------------------------------------------------------------------
-- Telemetry: attempts (every answer)
-- ----------------------------------------------------------------------------
create table public.attempts (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students(id) on delete cascade,
  question_id      uuid references public.questions(id) on delete set null,
  selected_index   int,
  is_correct       boolean,
  answered_at      timestamptz not null default now(),
  response_time_ms int
);

-- ----------------------------------------------------------------------------
-- Placement runs
-- ----------------------------------------------------------------------------
create table public.placement_sessions (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students(id) on delete cascade,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  asked           jsonb,                          -- [{question_id, skill_index, correct}]
  estimated_index int
);

-- ----------------------------------------------------------------------------
-- Daily feed sessions (streaks + completion)
-- ----------------------------------------------------------------------------
create table public.daily_sessions (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete cascade,
  session_date  date not null,
  question_ids  jsonb,
  num_completed int  not null default 0,
  num_correct   int  not null default 0,
  sent_at       timestamptz,
  completed_at  timestamptz,
  unique (student_id, session_date)
);

-- ----------------------------------------------------------------------------
-- One-time tokens to link a Telegram chat to a student (SERVER-ONLY)
-- ----------------------------------------------------------------------------
create table public.telegram_link_tokens (
  token      text primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  expires_at timestamptz,
  used       boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index idx_skills_curriculum_seq on public.skills (curriculum_id, sequence_position);
create index idx_skills_grade          on public.skills (grade);
create index idx_questions_skill_status on public.questions (skill_id, status);
create index idx_students_parent       on public.students (parent_id);
create index idx_ssp_student           on public.student_skill_progress (student_id);
create index idx_ssp_due               on public.student_skill_progress (student_id, next_due_at);
create index idx_attempts_student      on public.attempts (student_id, answered_at);
create index idx_daily_student_date    on public.daily_sessions (student_id, session_date);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.curricula              enable row level security;
alter table public.skills                 enable row level security;
alter table public.parents                enable row level security;
alter table public.students               enable row level security;
alter table public.questions              enable row level security;  -- no policies => service role only
alter table public.student_skill_progress enable row level security;
alter table public.attempts               enable row level security;
alter table public.placement_sessions     enable row level security;
alter table public.daily_sessions         enable row level security;
alter table public.telegram_link_tokens   enable row level security;  -- no policies => service role only

-- Reference data: any authenticated user may read curricula & skills.
create policy "curricula readable by authenticated"
  on public.curricula for select to authenticated using (true);

create policy "skills readable by authenticated"
  on public.skills for select to authenticated using (true);

-- Parents: a user can see and manage only their own parent row.
create policy "parent reads own row"
  on public.parents for select to authenticated using (id = auth.uid());
create policy "parent inserts own row"
  on public.parents for insert to authenticated with check (id = auth.uid());
create policy "parent updates own row"
  on public.parents for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Students: only the owning parent.
create policy "parent reads own students"
  on public.students for select to authenticated using (parent_id = auth.uid());
create policy "parent inserts own students"
  on public.students for insert to authenticated with check (parent_id = auth.uid());
create policy "parent updates own students"
  on public.students for update to authenticated using (parent_id = auth.uid()) with check (parent_id = auth.uid());
create policy "parent deletes own students"
  on public.students for delete to authenticated using (parent_id = auth.uid());

-- Child-scoped tables: readable by the owning parent (writes happen via service role).
create policy "parent reads own progress"
  on public.student_skill_progress for select to authenticated
  using (student_id in (select id from public.students where parent_id = auth.uid()));

create policy "parent reads own attempts"
  on public.attempts for select to authenticated
  using (student_id in (select id from public.students where parent_id = auth.uid()));

create policy "parent reads own placement"
  on public.placement_sessions for select to authenticated
  using (student_id in (select id from public.students where parent_id = auth.uid()));

create policy "parent reads own daily sessions"
  on public.daily_sessions for select to authenticated
  using (student_id in (select id from public.students where parent_id = auth.uid()));

-- ============================================================================
-- Reference seed: curricula (skills are seeded separately from the JSON ladder)
-- ============================================================================
insert into public.curricula (code, name)
values ('common_core', 'US Common Core')
on conflict (code) do nothing;
