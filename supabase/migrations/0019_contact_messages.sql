-- Parent-submitted feedback: bug reports, feature requests, ideas, questions.
-- Stored durably so nothing is lost even if the email notification fails.
create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references parents(id) on delete set null,
  email text,
  category text,
  subject text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- Only the server (service role) reads/writes these; no client access.
alter table contact_messages enable row level security;
