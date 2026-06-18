-- ============================================================================
-- Lessons: a short, kid-friendly "learn before you practice" page per
-- (curriculum, topic, grade). The child can read about a topic — what a
-- fraction is, how to add and subtract — before answering its questions.
--
-- Content is authored/generated OFFLINE and vetted (status). Never live AI to a
-- child. A topic simply shows a "Learn" step when a published lesson exists.
-- ============================================================================
create table if not exists public.lessons (
  id            uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  topic_id      uuid not null references public.topics(id)    on delete cascade,
  grade         int  not null,
  title         text not null,
  body          text not null,                  -- markdown
  status        text not null default 'draft',  -- draft | published | retired
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (curriculum_id, topic_id, grade),
  constraint lessons_status check (status in ('draft','published','retired'))
);

create index if not exists idx_lessons_lookup
  on public.lessons (curriculum_id, topic_id, grade, status);

alter table public.lessons enable row level security;

-- Published lessons are readable by any authenticated user (drafts stay
-- service-role only).
drop policy if exists "published lessons readable by authenticated" on public.lessons;
create policy "published lessons readable by authenticated"
  on public.lessons for select to authenticated using (status = 'published');
