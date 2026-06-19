-- ============================================================================
-- A/B waitlist demand test (/early). Two headlines compete:
--   A = cross-curriculum continuity (expat angle)
--   B = rigor-first / ad-free / mastery (trust angle)
-- We track impressions and signups per variant to measure which converts, and
-- capture an optional "situation" to see whether signups skew expat.
--
-- Server-only: RLS enabled, no policies => reached only via the service role in
-- API routes (the public never touches these tables directly).
-- ============================================================================
create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  variant    text not null,                 -- 'A' | 'B'
  situation  text,                          -- expat | international | homeschool | local | other
  session_id text,
  created_at timestamptz not null default now(),
  unique (email)
);

-- One row per landing session (the conversion denominator).
create table if not exists public.landing_views (
  session_id text primary key,
  variant    text not null,
  signed_up  boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.waitlist      enable row level security;  -- service role only
alter table public.landing_views enable row level security;  -- service role only
