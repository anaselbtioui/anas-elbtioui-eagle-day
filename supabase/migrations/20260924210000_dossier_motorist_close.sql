-- Shared motorist→desk close (cancel / archive). Pipeline status unchanged.

alter table dossiers
  add column if not exists closed_at timestamptz,
  add column if not exists closed_reason text;

alter table dossiers
  drop constraint if exists dossiers_closed_reason_check;

alter table dossiers
  add constraint dossiers_closed_reason_check
  check (closed_reason is null or closed_reason in ('cancelled', 'archived'));
