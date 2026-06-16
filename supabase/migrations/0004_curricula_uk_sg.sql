-- ============================================================================
-- Multi-curriculum: per-curriculum level labels + add UK and Singapore.
--
-- We keep ONE internal level integer (3/4/5) across all curricula so the
-- placement engine and schema are unchanged. Each curriculum just renders that
-- integer with its own noun + offset:
--   common_core  -> "Grade 3/4/5"   (offset 0)
--   uk_national  -> "Year 4/5/6"    (offset +1; UK Year = US grade + 1)
--   singapore    -> "Primary 3/4/5" (offset 0)
-- ============================================================================
alter table public.curricula
  add column if not exists grade_noun   text not null default 'Grade',
  add column if not exists grade_offset int  not null default 0;

update public.curricula set grade_noun = 'Grade', grade_offset = 0 where code = 'common_core';

insert into public.curricula (code, name, grade_noun, grade_offset) values
  ('uk_national', 'UK National Curriculum', 'Year', 1),
  ('singapore',   'Singapore Math',         'Primary', 0)
on conflict (code) do update
  set name = excluded.name, grade_noun = excluded.grade_noun, grade_offset = excluded.grade_offset;
