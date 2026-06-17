-- ============================================================================
-- Per-option (per-distractor) explanations for kid-friendly "why you got it
-- wrong" feedback. An array of 4 short, encouraging, kid-language strings — one
-- per option: for the correct option, why it's right; for each wrong option,
-- the common mistake that leads there and a gentle nudge.
--
-- Nullable: questions without it gracefully fall back to the single `explanation`.
-- ============================================================================
alter table public.questions
  add column if not exists option_explanations jsonb;

-- Optional integrity: when present it must be a 4-element array.
alter table public.questions
  drop constraint if exists questions_option_expl_len;
alter table public.questions
  add constraint questions_option_expl_len check (
    option_explanations is null
    or (jsonb_typeof(option_explanations) = 'array' and jsonb_array_length(option_explanations) = 4)
  );
