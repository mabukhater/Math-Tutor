-- ============================================================================
-- Kid logins. A child can sign in with a parent-set username + PIN. Under the
-- hood each kid login is its own Supabase Auth user (synthetic email + a strong
-- password derived from the PIN), kept separate from the parent account. This
-- table links that kid auth user to exactly one student.
--
-- A kid session can reach ONLY its own student's learning pages (enforced in
-- app code via resolveStudent). The parent remains the admin.
-- ============================================================================
create table if not exists public.kid_logins (
  student_id  uuid primary key references public.students(id) on delete cascade,
  username    text unique not null,                 -- lowercased
  kid_user_id uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists idx_kid_logins_user on public.kid_logins (kid_user_id);

alter table public.kid_logins enable row level security;

-- Parent can see their own children's logins (writes happen via the service
-- role in the management API).
drop policy if exists "parent reads own kid logins" on public.kid_logins;
create policy "parent reads own kid logins"
  on public.kid_logins for select to authenticated
  using (student_id in (select id from public.students where parent_id = auth.uid()));
