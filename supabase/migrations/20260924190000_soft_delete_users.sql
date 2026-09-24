-- Soft-delete accounts. Active emails stay unique; deleted rows keep history.

alter table app_users
  add column if not exists deleted_at timestamptz;

alter table app_users drop constraint if exists app_users_email_key;

create unique index if not exists app_users_email_active_uidx
  on app_users (email)
  where deleted_at is null;
