-- Labas domain. Service role on the Hono API; anon has no policies.

create table insurers (
  id text primary key,
  display_name text not null
);

create table brokers (
  id text primary key,
  display_name text not null
);

create table motorists (
  id text primary key,
  name text not null,
  phone text,
  also_tell_employer_if_commute boolean not null default false
);

create table vehicles (
  id text primary key,
  plate text,
  make_model text
);

create table policies (
  id text primary key,
  number text,
  insurer_id text not null references insurers (id),
  broker_id text references brokers (id),
  vehicle_id text not null references vehicles (id),
  assistance_on_contract text not null check (assistance_on_contract in ('yes', 'no', 'unknown'))
);

create table other_parties (
  id text primary key,
  status text not null check (status in ('known', 'unknown', 'refused', 'fled')),
  name text,
  plate text
);

create table incidents (
  id text primary key,
  motorist_id text not null references motorists (id),
  policy_id text references policies (id),
  occurred_at timestamptz,
  city text,
  injury text not null check (injury in ('no', 'yes', 'unknown')),
  vehicle_immobilised boolean not null default false,
  other_party_id text references other_parties (id),
  work_commute boolean
);

create table evidences (
  incident_id text primary key references incidents (id) on delete cascade,
  constat text not null check (constat in ('absent', 'started', 'complete')),
  pv text not null check (pv in ('not_needed', 'required', 'obtained')),
  damage_zones jsonb not null default '[]'::jsonb,
  photos jsonb not null default '[]'::jsonb
);

create table contacts (
  id text primary key,
  role text not null check (role in ('authorities', 'assistance', 'insurer_general', 'broker')),
  display_name text not null,
  phone text,
  url text,
  note text not null
);

create table declarations (
  id text primary key,
  incident_id text not null unique references incidents (id),
  narrative text not null default '',
  document_refs jsonb not null default '[]'::jsonb,
  channel text not null check (channel in ('broker', 'insurer_direct')),
  submitted_at timestamptz
);

create table dossiers (
  id text primary key,
  declaration_id text not null unique references declarations (id) on delete cascade,
  missing_pieces jsonb not null default '[]'::jsonb,
  status text not null check (status in (
    'draft',
    'blocked_missing_evidence',
    'declared',
    'waiting_motorist',
    'with_broker',
    'with_insurer'
  )),
  next_human_step text not null,
  notified_within_guidance_note text
);

alter table insurers enable row level security;
alter table brokers enable row level security;
alter table motorists enable row level security;
alter table vehicles enable row level security;
alter table policies enable row level security;
alter table other_parties enable row level security;
alter table incidents enable row level security;
alter table evidences enable row level security;
alter table contacts enable row level security;
alter table declarations enable row level security;
alter table dossiers enable row level security;

insert into insurers (id, display_name) values ('I-1', 'Assureur (stub)');
insert into brokers (id, display_name) values ('B-1', 'Courtier (stub)');
insert into motorists (id, name, phone, also_tell_employer_if_commute)
  values ('M-1', 'Nadia El Mansouri', '06•••••142', false);
insert into vehicles (id, plate, make_model)
  values ('V-1', '12345-A-50', 'Dacia Sandero · 2022');
insert into policies (id, number, insurer_id, broker_id, vehicle_id, assistance_on_contract)
  values ('P-1', 'MA-AUTO-24018', 'I-1', 'B-1', 'V-1', 'unknown');

insert into contacts (id, role, display_name, phone, url, note) values
  ('C-POLICE', 'authorities', 'Police / gendarmerie', '19', null, 'Urgence et procès-verbal. Pas un assureur.'),
  ('C-ASSIST', 'assistance', 'Assistance (exemple contrat)', '3434', 'https://sanlam.ma/fr/sinistres/accident-de-voiture/', 'Assistance 24 h/24 si le contrat le prévoit. Pas l’assureur, pas un secours d’État.'),
  ('C-INS', 'insurer_general', 'Relation client assureur (exemple)', '2526', null, 'Ligne générale. Pas un service d’urgence.'),
  ('C-BROKER', 'broker', 'Courtier (stub)', '+212 5 22 27 03 43', null, 'Canal de la déclaration. Ne décide pas la garantie.');
