-- 0024_placement_pending_question.sql
-- Security fix: the placement answer route graded ANY client-supplied questionId
-- and returned its correct_index, turning /api/placement/answer into an
-- answer-key oracle for the whole question bank. We now pin the one question the
-- server actually served (pending_question_id) and only grade that one — the
-- same ordering guard /api/practice/answer already enforces via question_ids.
alter table public.placement_sessions
  add column if not exists pending_question_id uuid references public.questions(id);
