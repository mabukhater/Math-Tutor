-- Record which reading question an attempt was for (math attempts use question_id,
-- which FKs to the math questions table; reading question ids live in
-- reading_questions). Enables per-question right/wrong review for reading.
alter table public.attempts
  add column if not exists reading_question_id uuid references public.reading_questions(id) on delete set null;
create index if not exists attempts_student_reading_q_idx
  on public.attempts(student_id, reading_question_id);
