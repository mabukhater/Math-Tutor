-- ============================================================================
-- AI Literacy Course — schema additions
--
-- AC coverage map (reviewer cross-reference):
--   AC-1.3, AC-2.1/2.2/2.4/2.5  passages.subject discriminator
--   AC-3.1/3.2                   passages.subject enables getAICoursePath prereq check
--   AC-4.1..4.6, AC-5.1..5.5     capstones / capstone_milestones / capstone_artifacts
--   AC-4.3                       position ordering on capstone_milestones
--   AC-4.4                       requirement jsonb on capstone_milestone_templates
--   AC-4.5                       rubric jsonb on capstone_milestones
--   AC-6.1..6.4                  capstone_attestations; no INSERT RLS (admin-client only)
--   AC-7.2/7.3/7.4               SELECT policies on all capstone tables and Storage bucket
--   AC-8.2/8.3                   capstone_milestone_templates holds static offline content
--   AC-8.5                       reading_questions unchanged (RLS on, no policies)
--   AC-2.4/8.5                   no new policy added to reading_questions — invariant unchanged
--
-- Storage bucket note (reviewer):
--   The INSERT statement for the `capstone-artifacts` bucket targets
--   storage.buckets, which requires service-role access. In environments where
--   the bucket can only be created via the Supabase Dashboard or the Management
--   API, comment out the INSERT and create the bucket manually, then apply only
--   the storage.objects policy below.
--
-- Forward-only migration. To roll back:
--   DROP TABLE public.capstone_attestations CASCADE;
--   DROP TABLE public.capstone_artifacts CASCADE;
--   DROP TABLE public.capstone_milestones CASCADE;
--   DROP TABLE public.capstones CASCADE;
--   DROP TABLE public.capstone_milestone_templates CASCADE;
--   DELETE FROM storage.objects WHERE bucket_id = 'capstone-artifacts';
--   DELETE FROM storage.buckets WHERE id = 'capstone-artifacts';
--   ALTER TABLE public.passages DROP COLUMN IF EXISTS subject;
-- ============================================================================

-- ============================================================================
-- 1. passages.subject — subject discriminator (AC-1.3, AC-2.1, AC-3.1/3.2)
-- ============================================================================
-- The ALTER + UPDATE is two logical steps but one migration:
--   Step A: add the column with a default (automatically backfills all existing
--           rows to 'reading' in the same DDL statement).
--   Step B: add the check constraint separately so the do-$$-end guard is clean.

alter table public.passages
  add column if not exists subject text not null default 'reading';

-- Idempotent constraint guard (matches 0014_reading_difficulty.sql pattern).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'passages_subject_check'
  ) then
    alter table public.passages
      add constraint passages_subject_check
        check (subject in ('reading', 'ai7', 'ai8'));
  end if;
end $$;

-- Index supporting getAICoursePath (and getReadingPath).
-- Query shape: WHERE subject = $1 AND status = 'published'
--              ORDER BY week, level_order
-- Existing idx_passages_week covers (grade, week, level_order) which is NOT
-- useful for subject-based queries. This new index replaces its role for AI
-- while keeping the old one for the Reading path which still filters on grade.
create index if not exists idx_passages_subject_week
  on public.passages (subject, week, level_order);

-- ============================================================================
-- 2. capstone_milestone_templates — offline-seeded static content (AC-8.2/8.3)
-- ============================================================================
-- One row per (level, slug). Not per-student; the per-student milestone rows
-- join here at read time so a content edit reaches all in-flight students
-- instantly (OQ-8 recommendation).
-- RLS: SELECT open to authenticated (static published reference copy — same
-- pattern as `curricula` and `skills` in 0001_init.sql). No INSERT/UPDATE
-- policy; edits go through the service role (Studio / seed migration).

create table if not exists public.capstone_milestone_templates (
  id           uuid primary key default gen_random_uuid(),
  level        int  not null,                   -- 7 (AI-free) or 8 (parent-mediated)
  slug         text not null,                   -- idea|plan|build_v1|test_feedback|ship|reflect
  position     int  not null,                   -- 1..6 sequential unlock order (AC-4.3)
  title        text not null,
  description  text not null,
  requirement  jsonb not null,
    -- { "requiresArtifact": bool, "allowedKinds": ["file","url","text"], "minCount": 1 }
    -- Controls whether milestone-submit endpoint requires an artifact (AC-4.4).
  content      jsonb,
    -- L8 only: project-kit instructions, prompt templates, checkpoint questions (AC-8.3).
    -- NULL for L7 milestones.
  created_at   timestamptz not null default now(),
  constraint capstone_milestone_templates_level_slug unique (level, slug),
  constraint capstone_milestone_templates_level_check check (level in (7, 8)),
  constraint capstone_milestone_templates_slug_check
    check (slug in ('idea','plan','build_v1','test_feedback','ship','reflect')),
  constraint capstone_milestone_templates_position_check check (position between 1 and 6)
);

alter table public.capstone_milestone_templates enable row level security;

drop policy if exists "capstone templates readable by authenticated"
  on public.capstone_milestone_templates;
create policy "capstone templates readable by authenticated"
  on public.capstone_milestone_templates for select to authenticated
  using (true);

-- ============================================================================
-- 3. capstones — one row per (student, level) (AC-4.1, AC-5.1, AC-6.2)
-- ============================================================================
-- Lazily created on first open (mirrors getOrCreateReadingBlock pattern).
-- completed_at is NULL until the parent attests (AC-6.2); never set by milestone
-- submission.

create table if not exists public.capstones (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(id) on delete cascade,
  level        int  not null,           -- 7 or 8
  created_at   timestamptz not null default now(),
  completed_at timestamptz,             -- NULL until parent attestation (AC-6.2)
  constraint capstones_student_level unique (student_id, level),
  constraint capstones_level_check check (level in (7, 8))
);

create index if not exists idx_capstones_student
  on public.capstones (student_id, level);

alter table public.capstones enable row level security;

-- AC-7.2: parent reads own students' capstones (direct portfolio read).
drop policy if exists "parent reads own capstones" on public.capstones;
create policy "parent reads own capstones"
  on public.capstones for select to authenticated
  using (
    student_id in (
      select id from public.students where parent_id = auth.uid()
    )
  );

-- No INSERT / UPDATE policies. All writes go through the admin (service-role)
-- client in the capstone endpoints (AC-6.4, OQ-5 pattern).

-- ============================================================================
-- 4. capstone_milestones — per-student progress spine (AC-4.1..4.5)
-- ============================================================================
-- One row per (capstone_id, slug). Joins capstone_milestone_templates for
-- content / requirement at read time. Only progress fields live here.
-- "Complete" is computed: submitted_at IS NOT NULL AND artifacts satisfy
-- requirement — never a stored boolean (avoids drift, mirrors OQ-2 reasoning).

create table if not exists public.capstone_milestones (
  id           uuid primary key default gen_random_uuid(),
  capstone_id  uuid not null references public.capstones(id) on delete cascade,
  slug         text not null,           -- idea|plan|build_v1|test_feedback|ship|reflect
  position     int  not null,           -- 1..6 copied from template at row creation
  submitted_at timestamptz,             -- NULL = not yet submitted (AC-4.3 gate)
  rubric       jsonb,
    -- Only the 'reflect' milestone populates this.
    -- { "shipped": true|false, "works": true|false, "documented": true|false }
    -- Recorded but does NOT block completion (AC-4.5).
  created_at   timestamptz not null default now(),
  constraint capstone_milestones_capstone_slug unique (capstone_id, slug),
  constraint capstone_milestones_slug_check
    check (slug in ('idea','plan','build_v1','test_feedback','ship','reflect')),
  constraint capstone_milestones_position_check check (position between 1 and 6)
);

-- Supports the sequential-unlock query: "load all milestones for this capstone
-- ordered by position" — used for first-incomplete-wins (AC-4.3).
create index if not exists idx_capstone_milestones_capstone
  on public.capstone_milestones (capstone_id, position);

alter table public.capstone_milestones enable row level security;

-- AC-7.2: parent reads via capstone → student ownership chain.
drop policy if exists "parent reads own capstone milestones" on public.capstone_milestones;
create policy "parent reads own capstone milestones"
  on public.capstone_milestones for select to authenticated
  using (
    capstone_id in (
      select c.id from public.capstones c
      join public.students s on s.id = c.student_id
      where s.parent_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. capstone_artifacts — uploaded files, URLs, and pasted text (AC-4.4, AC-5.3)
-- ============================================================================
-- One artifact row per submitted artifact. One milestone may have 0..N.
-- text and url stay as columns (no Storage round-trip for common paste case).
-- storage_path is the object path inside the capstone-artifacts bucket (OQ-4).
-- Constraint: exactly one of (url / body_text / storage_path) must be non-null,
-- matching the kind discriminator.

create table if not exists public.capstone_artifacts (
  id            uuid primary key default gen_random_uuid(),
  milestone_id  uuid not null references public.capstone_milestones(id) on delete cascade,
  kind          text not null,           -- url | text | file
  url           text,                    -- populated when kind = 'url'
  body_text     text,                    -- populated when kind = 'text'
  storage_path  text,                    -- populated when kind = 'file' (OQ-4 path convention)
  mime          text,                    -- populated when kind = 'file'
  created_at    timestamptz not null default now(),
  constraint capstone_artifacts_kind_check
    check (kind in ('url', 'text', 'file')),
  -- Enforce that the correct payload column is populated for each kind.
  constraint capstone_artifacts_url_populated
    check (kind <> 'url'  or url          is not null),
  constraint capstone_artifacts_text_populated
    check (kind <> 'text' or body_text    is not null),
  constraint capstone_artifacts_file_populated
    check (kind <> 'file' or storage_path is not null),
  -- Prevent cross-contamination: each column only populated for its kind.
  constraint capstone_artifacts_url_exclusive
    check (kind = 'url'  or url          is null),
  constraint capstone_artifacts_text_exclusive
    check (kind = 'text' or body_text    is null),
  constraint capstone_artifacts_file_exclusive
    check (kind = 'file' or storage_path is null)
);

-- Supports loading all artifacts for a milestone or the inverse (find milestone
-- for a storage path during signed-URL generation).
create index if not exists idx_capstone_artifacts_milestone
  on public.capstone_artifacts (milestone_id);

create index if not exists idx_capstone_artifacts_storage_path
  on public.capstone_artifacts (storage_path)
  where storage_path is not null;

alter table public.capstone_artifacts enable row level security;

-- AC-7.2: parent reads via artifact → milestone → capstone → student chain.
drop policy if exists "parent reads own capstone artifacts" on public.capstone_artifacts;
create policy "parent reads own capstone artifacts"
  on public.capstone_artifacts for select to authenticated
  using (
    milestone_id in (
      select m.id from public.capstone_milestones m
      join public.capstones c on c.id = m.capstone_id
      join public.students s  on s.id = c.student_id
      where s.parent_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. capstone_attestations — parent sign-off (AC-6.1..6.4)
-- ============================================================================
-- Insert-only in practice; no UPDATE/DELETE path in the application (AC-6.3).
-- Unique on capstone_id: one attestation per capstone lifetime.
-- parent_id references auth.users (same as parents.id — 1:1 per 0001_init.sql).

create table if not exists public.capstone_attestations (
  id           uuid primary key default gen_random_uuid(),
  capstone_id  uuid not null references public.capstones(id) on delete cascade,
  parent_id    uuid not null references auth.users(id) on delete restrict,
    -- ON DELETE RESTRICT: if a parent auth account is deleted we want an
    -- explicit error rather than silently orphaning the attestation record.
  attested_at  timestamptz not null default now(),
  note         text,                    -- optional free-text note (AC-6.2)
  constraint capstone_attestations_capstone_unique unique (capstone_id)
    -- Exactly one attestation per capstone (AC-6.3: un-attest not possible).
);

create index if not exists idx_capstone_attestations_capstone
  on public.capstone_attestations (capstone_id);

create index if not exists idx_capstone_attestations_parent
  on public.capstone_attestations (parent_id);

alter table public.capstone_attestations enable row level security;

-- AC-7.2: parent reads their own attestations via capstone → student chain.
drop policy if exists "parent reads own capstone attestations" on public.capstone_attestations;
create policy "parent reads own capstone attestations"
  on public.capstone_attestations for select to authenticated
  using (
    capstone_id in (
      select c.id from public.capstones c
      join public.students s on s.id = c.student_id
      where s.parent_id = auth.uid()
    )
  );

-- AC-6.4 / OQ-5: NO INSERT policy. All writes go through the admin client in
-- the attestation endpoint after verifying access.role === 'parent' at the
-- app layer. A leaked kid token cannot INSERT directly even if the endpoint
-- check were bypassed — there is simply no RLS path for it to succeed.

-- ============================================================================
-- 7. Storage bucket: capstone-artifacts (OQ-4, AC-7.2/7.4)
-- ============================================================================
-- Private bucket (public = false). Uploads go through the admin client in the
-- artifact upload endpoint; no client-direct uploads (no INSERT policy needed).
-- Path convention enforced by the upload endpoint (not DB):
--   {student_id}/{capstone_id}/{milestone_id}/{uuid}-{filename}
-- File size / MIME limits enforced server-side (upload endpoint) and ideally
-- also as bucket-level settings set via the Dashboard or Management API:
--   max file size: 10 MB, allowed MIME: image/png, image/jpeg, image/webp, application/pdf
--
-- NOTE FOR REVIEWER: storage.buckets is accessible via the service role. In a
-- plain SQL migration run via `supabase db push` the INSERT below will succeed.
-- If you are running migrations via the MCP apply_migration tool or the Supabase
-- Dashboard SQL editor you may need to create the bucket separately using the
-- Storage UI and apply only the policy below.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'capstone-artifacts',
  'capstone-artifacts',
  false,              -- private (AC-7.4)
  10485760,           -- 10 MB in bytes (OQ-4)
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Storage RLS: parent may SELECT (read) only objects whose first path segment
-- is one of their own students' IDs (OQ-4, AC-7.2/7.4).
-- Path convention: {student_id}/{capstone_id}/{milestone_id}/...
-- (storage.foldername(name))[1] extracts the first segment of the object path.
--
-- Kids never read via Storage RLS (they have no parent-scoped identity at the
-- RLS layer). Kid-session reads of their own artifacts are served as short-TTL
-- signed URLs minted server-side by the admin client after resolveStudent
-- confirms ownership (AC-7.4).

drop policy if exists "parent reads own capstone artifact objects"
  on storage.objects;
create policy "parent reads own capstone artifact objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'capstone-artifacts'
    and (storage.foldername(name))[1] in (
      select id::text from public.students where parent_id = auth.uid()
    )
  );

-- No INSERT policy on storage.objects for this bucket.
-- Uploads are admin-client only, going through the upload endpoint which takes
-- the student_id from resolveStudent (server-resolved, not from client input).
-- This prevents cross-student path injection (OQ-4).

-- ============================================================================
-- 8. Seed: capstone_milestone_templates
-- ============================================================================
-- 6 milestones × 2 levels = 12 rows.
-- Copy is placeholder; the real editorial copy is an offline content workstream.
-- STRUCTURE (columns/shape) is authoritative and complete for engineering.
--
-- requirement shape: { "requiresArtifact": bool, "allowedKinds": [...], "minCount": N }
-- content shape (L8 only): {
--   "instructions": "...",
--   "promptTemplates": ["..."],
--   "checkpointQuestions": ["..."]
-- }

-- ---- Level 7 (AI-free capstone) ----

insert into public.capstone_milestone_templates
  (level, slug, position, title, description, requirement, content)
values
  (
    7, 'idea', 1,
    'Milestone 1: Your Idea',
    '[EDITORIAL PLACEHOLDER] Describe an AI-thinking project you could do without a live AI account. What problem does it solve? Who is it for?',
    '{"requiresArtifact": false, "allowedKinds": [], "minCount": 0}'::jsonb,
    null
  ),
  (
    7, 'plan', 2,
    'Milestone 2: Your Plan',
    '[EDITORIAL PLACEHOLDER] Break your project into steps. Write the "prompt you would send" if you had access to an AI — this is an offline exercise in prompt thinking.',
    '{"requiresArtifact": true, "allowedKinds": ["text","url","file"], "minCount": 1}'::jsonb,
    null
  ),
  (
    7, 'build_v1', 3,
    'Milestone 3: Build v1',
    '[EDITORIAL PLACEHOLDER] Create your first version using only tools you already have (paper, a word processor, a presentation app). No live AI required.',
    '{"requiresArtifact": true, "allowedKinds": ["text","url","file"], "minCount": 1}'::jsonb,
    null
  ),
  (
    7, 'test_feedback', 4,
    'Milestone 4: Test & Feedback',
    '[EDITORIAL PLACEHOLDER] Share your v1 with at least one other person. Record their feedback. What worked? What needs improvement?',
    '{"requiresArtifact": true, "allowedKinds": ["text","file"], "minCount": 1}'::jsonb,
    null
  ),
  (
    7, 'ship', 5,
    'Milestone 5: Ship',
    '[EDITORIAL PLACEHOLDER] Finalize your project based on feedback. Submit the final version (a file, a URL, or a description).',
    '{"requiresArtifact": true, "allowedKinds": ["text","url","file"], "minCount": 1}'::jsonb,
    null
  ),
  (
    7, 'reflect', 6,
    'Milestone 6: Reflect',
    '[EDITORIAL PLACEHOLDER] Answer three questions about your finished project. Your answers are recorded but do not affect completion.',
    '{"requiresArtifact": false, "allowedKinds": [], "minCount": 0}'::jsonb,
    null
    -- rubric captured on capstone_milestones, not here; no kit content for L7
  )
on conflict (level, slug) do nothing;

-- ---- Level 8 (parent-mediated capstone with project kit) ----

insert into public.capstone_milestone_templates
  (level, slug, position, title, description, requirement, content)
values
  (
    8, 'idea', 1,
    'Milestone 1: Your Idea',
    '[EDITORIAL PLACEHOLDER] What real-world product or tool could you build with AI assistance (with your parent''s help setting up access)?',
    '{"requiresArtifact": false, "allowedKinds": [], "minCount": 0}'::jsonb,
    null
  ),
  (
    8, 'plan', 2,
    'Milestone 2: Your Plan',
    '[EDITORIAL PLACEHOLDER] Map out your project: the goal, the audience, the tools you''ll use, and how your parent will supervise the AI sessions.',
    '{"requiresArtifact": true, "allowedKinds": ["text","url","file"], "minCount": 1}'::jsonb,
    null
  ),
  (
    8, 'build_v1', 3,
    'Milestone 3: Build v1',
    '[EDITORIAL PLACEHOLDER] Build your first version using an external AI tool your parent has set up. Use the project kit below during your supervised session.',
    '{"requiresArtifact": true, "allowedKinds": ["text","url","file"], "minCount": 1}'::jsonb,
    '{
      "instructions": "[EDITORIAL PLACEHOLDER] Step-by-step instructions for your first supervised AI session. Copy the prompt templates below into your AI tool and record the results.",
      "promptTemplates": [
        "[PLACEHOLDER PROMPT 1] Describe your project goal to the AI and ask it to suggest an approach.",
        "[PLACEHOLDER PROMPT 2] Ask the AI to help you outline the key steps for building your project.",
        "[PLACEHOLDER PROMPT 3] Have the AI review your plan and suggest improvements."
      ],
      "checkpointQuestions": [
        "[PLACEHOLDER] What did the AI suggest that surprised you?",
        "[PLACEHOLDER] Where did the AI''s output need your own judgment to correct or improve?",
        "[PLACEHOLDER] What would you change about your prompts next time?"
      ]
    }'::jsonb
  ),
  (
    8, 'test_feedback', 4,
    'Milestone 4: Test & Feedback',
    '[EDITORIAL PLACEHOLDER] Share your v1 with at least one person outside the family. Record what they said and what you plan to change.',
    '{"requiresArtifact": true, "allowedKinds": ["text","file"], "minCount": 1}'::jsonb,
    null
  ),
  (
    8, 'ship', 5,
    'Milestone 5: Ship',
    '[EDITORIAL PLACEHOLDER] Make your final version live (or submit the finished artifact). Use the project kit below for your final supervised AI session if needed.',
    '{"requiresArtifact": true, "allowedKinds": ["text","url","file"], "minCount": 1}'::jsonb,
    '{
      "instructions": "[EDITORIAL PLACEHOLDER] Your final supervised session checklist. Review the kit before you start.",
      "promptTemplates": [
        "[PLACEHOLDER PROMPT] Ask the AI to review your final version for errors or missing pieces.",
        "[PLACEHOLDER PROMPT] Ask the AI to help you write a one-paragraph description of your project for sharing."
      ],
      "checkpointQuestions": [
        "[PLACEHOLDER] Is the final version ready to share? What''s still missing?",
        "[PLACEHOLDER] How would you describe what AI helped with vs. what you did yourself?",
        "[PLACEHOLDER] What is the most important thing you learned building this?"
      ]
    }'::jsonb
  ),
  (
    8, 'reflect', 6,
    'Milestone 6: Reflect',
    '[EDITORIAL PLACEHOLDER] Answer three final questions about your shipped project. Your parent will review these before attesting.',
    '{"requiresArtifact": false, "allowedKinds": [], "minCount": 0}'::jsonb,
    null
  )
on conflict (level, slug) do nothing;
