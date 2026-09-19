-- Desk-only tables. Same dossier ids. No coverage / payout columns.

create table desk_files (
  dossier_id text primary key references dossiers (id) on delete cascade,
  title text not null,
  source text not null,
  freshness text not null,
  owner text not null,
  tasks jsonb not null default '[]'::jsonb,
  requests jsonb not null default '[]'::jsonb,
  drafts jsonb not null default '[]'::jsonb
);

alter table desk_files enable row level security;
