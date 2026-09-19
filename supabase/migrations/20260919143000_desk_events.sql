-- Desk timeline events (operational only; no fault / payout).

alter table desk_files
  add column if not exists events jsonb not null default '[]'::jsonb;
