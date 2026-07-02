-- 0025_kid_login_attempts.sql
-- Security fix: /api/kids/signin had no throttle, so a 4-digit PIN (10^4 space)
-- was brute-forceable once a username was known. Track failed attempts per
-- username in Postgres (so the limit holds across serverless instances) and
-- lock the account for a cool-off window after too many misses.
create table if not exists public.kid_login_attempts (
  username     text primary key,           -- lowercased kid username
  fails        int not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);

-- Server-only: written/read exclusively by the signin route via the service
-- role. RLS on with no policies keeps it unreachable by anon/authenticated.
alter table public.kid_login_attempts enable row level security;
