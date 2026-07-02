-- 0023_security_hardening.sql
-- Addresses Supabase linter findings (2026-06-30):
--   * a public backup table had RLS disabled (fully exposed via the anon key)
--   * two analytics views were SECURITY DEFINER (bypassed caller RLS)
--   * skills_with_vetted had a role-mutable search_path
-- Guardrail unchanged: questions.correct_index must never be reachable by a
-- non-service-role client. These views are read through the service-role admin
-- client (the /vet screen), which bypasses RLS regardless of invoker/definer.

-- 1. Drop the leftover reading-distractor backup snapshot (RLS was off).
drop table if exists public.reading_questions_distractor_backup_20260628;

-- 2. Make analytics views respect the querying role's RLS, not the creator's.
alter view public.question_stats set (security_invoker = on);
alter view public.question_calibration_flags set (security_invoker = on);

-- 3. Pin the function search_path (was role-mutable). The body references
--    public.questions / public.skills, so pin to public rather than ''.
alter function public.skills_with_vetted(uuid) set search_path = public;
