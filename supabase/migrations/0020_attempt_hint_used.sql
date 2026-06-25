-- Track when a child used the "Get a hint" aid on a reading question, so it can
-- be surfaced in the attempts review. The answer still counts normally.
alter table attempts
  add column if not exists hint_used boolean not null default false;
