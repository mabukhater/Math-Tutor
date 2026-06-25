-- Distinct skills that have at least one vetted question, for a curriculum.
-- The learning path needs this set, but selecting it from `questions` hits
-- PostgREST's 1000-row response cap (a curriculum has thousands of vetted
-- questions), which silently dropped later grades' weeks. This aggregates in
-- the database and returns at most one row per skill.
create or replace function skills_with_vetted(cur uuid)
returns table(skill_id uuid)
language sql
stable
as $$
  select distinct q.skill_id
  from questions q
  join skills s on s.id = q.skill_id
  where s.curriculum_id = cur and q.status = 'vetted';
$$;
