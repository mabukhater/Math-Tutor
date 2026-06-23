-- Stripe billing: track each parent's plan, the Stripe customer/subscription, and
-- (for the One Subject plan) which subject is unlocked. subscription_status already
-- exists and holds the Stripe status (active | past_due | canceled | ...).
alter table public.parents
  add column if not exists subscription_plan text not null default 'free',  -- free | one | all
  add column if not exists subscription_subject text,                        -- math | reading (One plan)
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;
create index if not exists parents_stripe_customer_idx on public.parents(stripe_customer_id);
