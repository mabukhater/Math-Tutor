-- ============================================================================
-- Calibration: give reading questions a difficulty rating (1-5), like math
-- questions already have. Derived from question type + grade, then used to
-- serve each block easiest-first so a child ramps up.
-- ============================================================================
alter table public.reading_questions
  add column if not exists difficulty int not null default 2;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reading_q_difficulty') then
    alter table public.reading_questions
      add constraint reading_q_difficulty check (difficulty between 1 and 5);
  end if;
end $$;
