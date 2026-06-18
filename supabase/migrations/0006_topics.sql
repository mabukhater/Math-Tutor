-- ============================================================================
-- Topics: a normalized, kid-friendly taxonomy that sits ABOVE the per-curriculum
-- skill ladders. Every skill maps to exactly one topic, so the same friendly
-- categories (Addition, Fractions, Money, Geometry, Algebra, ...) appear across
-- US Common Core, the UK National Curriculum, and Singapore Math.
--
-- Design:
--  * topics: reference table, readable by any authenticated user.
--  * skills.topic_id: each skill belongs to one topic (nullable until mapped;
--    backfilled deterministically by generator/map_topics.py).
--  * topic_sessions: focused "extra practice" sets, fully separate from
--    daily_sessions so streaks and the spaced-repetition scheduler are
--    untouched. Answers still log to attempts and update student_skill_progress.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Reference: topics
-- ----------------------------------------------------------------------------
create table if not exists public.topics (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,          -- 'addition'
  name       text not null,                 -- 'Addition'
  icon       text,                          -- UI icon token
  sort_order int  not null default 0
);

alter table public.topics enable row level security;

drop policy if exists "topics readable by authenticated" on public.topics;
create policy "topics readable by authenticated"
  on public.topics for select to authenticated using (true);

-- Operations are presented as combined cards (Add & Subtract, Multiply & Divide)
-- because early skills genuinely cover both, and that's how the curricula group
-- them. Each skill still maps to exactly one topic.
insert into public.topics (code, name, icon, sort_order) values
  ('numbers',         'Numbers & Place Value',     'hash',     10),
  ('add_sub',         'Addition & Subtraction',    'plusminus',20),
  ('mult_div',        'Multiplication & Division', 'timesdiv', 30),
  ('fractions',       'Fractions',                 'pie',      40),
  ('decimals',        'Decimals',                  'decimal',  50),
  ('percentages',     'Percentages',               'percent',  60),
  ('money',           'Money',                     'dollar',   70),
  ('measurement',     'Measurement',               'ruler',    80),
  ('time',            'Time',                      'clock',    90),
  ('geometry',        'Geometry & Shapes',         'shapes',  100),
  ('data',            'Data & Graphs',             'chart',   110),
  ('ratio',           'Ratio & Proportion',        'ratio',   120),
  ('algebra',         'Algebra',                   'algebra', 130),
  ('problem_solving', 'Problem Solving',           'bulb',    140)
on conflict (code) do update
  set name = excluded.name, icon = excluded.icon, sort_order = excluded.sort_order;

-- Drop any earlier-seeded codes no longer in the set (safe: no skills mapped yet).
delete from public.topics where code not in (
  'numbers','add_sub','mult_div','fractions','decimals','percentages','money',
  'measurement','time','geometry','data','ratio','algebra','problem_solving'
);

-- ----------------------------------------------------------------------------
-- skills.topic_id (one topic per skill)
-- ----------------------------------------------------------------------------
alter table public.skills
  add column if not exists topic_id uuid references public.topics(id);

create index if not exists idx_skills_topic on public.skills (topic_id);

-- ----------------------------------------------------------------------------
-- topic_sessions: isolated focused-practice sets (does NOT touch daily_sessions)
-- ----------------------------------------------------------------------------
create table if not exists public.topic_sessions (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete cascade,
  topic_id      uuid not null references public.topics(id)   on delete cascade,
  question_ids  jsonb not null,
  num_completed int  not null default 0,
  num_correct   int  not null default 0,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists idx_topic_sessions_student
  on public.topic_sessions (student_id, created_at desc);

alter table public.topic_sessions enable row level security;

-- Parent may read their own children's topic sessions (writes go through the
-- service role in server routes, like daily_sessions).
drop policy if exists "parent reads own topic sessions" on public.topic_sessions;
create policy "parent reads own topic sessions"
  on public.topic_sessions for select to authenticated
  using (student_id in (select id from public.students where parent_id = auth.uid()));
