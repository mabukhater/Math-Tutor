-- ============================================================================
-- question_stats — live per-question calibration tally.
--
-- Aggregates every row in `attempts` so you can see, per question: how many
-- times it's been answered, how many right/wrong, the observed accuracy, and
-- the full choice distribution (how many people picked A/B/C/D). Compare
-- `accuracy` against `stated_difficulty` to recalibrate, and read the
-- A/B/C/D spread to see which distractor (misconception) is pulling people.
--
-- It's a VIEW, so it's always current — nothing to maintain. Browse it in the
-- Supabase Table Editor or query it in the SQL editor.
-- ============================================================================
create or replace view public.question_stats as
select
  q.id                                                            as question_id,
  q.skill_id,
  s.code                                                          as skill_code,
  s.grade,
  q.stem,
  q.difficulty                                                    as stated_difficulty,
  q.correct_index,
  q.status,
  count(a.id)                                                     as times_answered,
  count(a.id) filter (where a.is_correct)                         as times_correct,
  count(a.id) filter (where a.is_correct is false)               as times_wrong,
  round(
    count(a.id) filter (where a.is_correct)::numeric
      / nullif(count(a.id), 0),
    3
  )                                                               as accuracy,
  count(a.id) filter (where a.selected_index = 0)                 as chose_a,
  count(a.id) filter (where a.selected_index = 1)                 as chose_b,
  count(a.id) filter (where a.selected_index = 2)                 as chose_c,
  count(a.id) filter (where a.selected_index = 3)                 as chose_d,
  round(avg(a.response_time_ms))                                  as avg_response_ms,
  max(a.answered_at)                                              as last_answered_at
from public.questions q
join public.skills s on s.id = q.skill_id
left join public.attempts a on a.question_id = q.id
group by q.id, q.skill_id, s.code, s.grade, q.stem, q.difficulty, q.correct_index, q.status;

-- Convenience: questions whose observed accuracy disagrees with their stated
-- difficulty (needs a minimum sample). Surfaces miscalibrated items first.
create or replace view public.question_calibration_flags as
select *,
  case
    when times_answered < 10 then 'insufficient_data'
    when stated_difficulty <= 2 and accuracy < 0.55 then 'harder_than_labeled'
    when stated_difficulty >= 4 and accuracy > 0.90 then 'easier_than_labeled'
    else 'ok'
  end as flag
from public.question_stats;
