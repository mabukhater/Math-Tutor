-- ============================================================================
-- Reading weeks. Group passages into weeks (3-4 passages each) that get longer
-- and harder week over week — mirroring the math ladder (week = section,
-- passage = rung). Passages unlock in order; finishing a week unlocks the next.
-- ============================================================================
alter table public.passages
  add column if not exists week int not null default 1;

create index if not exists idx_passages_week
  on public.passages (grade, week, level_order);
