-- Wallet meta on motorist: names, client-only fields, optimistic concurrency.

alter table motorists
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists assistance_number text,
  add column if not exists broker_phone text,
  add column if not exists onboarding_step integer default 0,
  add column if not exists updated_at timestamptz default now();
