-- App accounts. Service role on the Hono API; anon has no policies.

create table app_users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  role text not null check (role in ('motorist', 'broker')),
  display_name text not null,
  onboarded boolean not null default false,
  motorist_id text references motorists (id),
  broker_id text references brokers (id),
  vehicle_id text references vehicles (id),
  insurer_id text references insurers (id),
  policy_id text references policies (id),
  created_at timestamptz not null default now(),
  constraint app_users_role_links check (
    (role = 'motorist' and motorist_id is not null and policy_id is not null)
    or (role = 'broker' and broker_id is not null)
  )
);

alter table app_users enable row level security;
