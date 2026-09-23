-- Persist motorist archive stamps on incidents (no device-only archive).
alter table incidents
  add column if not exists archived_at timestamptz;
