-- Parent profile (name + address) and onboarding flag; child birthdate.
alter table parents
  add column if not exists full_name text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists region text,
  add column if not exists postal_code text,
  add column if not exists country text,
  add column if not exists phone text,
  add column if not exists onboarding_completed boolean not null default false;

alter table students
  add column if not exists birthdate date;
