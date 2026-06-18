-- ============================================================================
-- Visual questions (esp. grades 1-3): an optional parametric visual rendered
-- above the stem. The column holds a small spec the web app draws as crisp SVG:
--   { "type": "count",        "params": { "n": 7, "shape": "apple" } }
--   { "type": "number_line",  "params": { "min": 0, "max": 10, "step": 1, "mark": 6 } }
--   { "type": "fraction_bar", "params": { "parts": 4, "shaded": 3 } }
--   { "type": "array",        "params": { "rows": 3, "cols": 4 } }
-- Null => a plain text question (the existing behavior). Still 4-option MC.
-- ============================================================================
alter table public.questions
  add column if not exists visual jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'questions_visual_obj') then
    alter table public.questions
      add constraint questions_visual_obj
      check (visual is null or jsonb_typeof(visual) = 'object');
  end if;
end $$;
