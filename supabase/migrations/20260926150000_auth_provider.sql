-- Google OAuth (and future providers). Password users keep a hash; Google-only may be null.

alter table app_users
  add column if not exists auth_provider text not null default 'password';

alter table app_users
  drop constraint if exists app_users_auth_provider_check;

alter table app_users
  add constraint app_users_auth_provider_check
  check (auth_provider in ('password', 'google'));

alter table app_users
  alter column password_hash drop not null;

alter table app_users
  drop constraint if exists app_users_auth_password_chk;

alter table app_users
  add constraint app_users_auth_password_chk check (
    (auth_provider = 'password' and password_hash is not null)
    or (auth_provider = 'google')
  );
