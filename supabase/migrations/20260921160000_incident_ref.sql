-- Friendly human refs for incidents (UUID stays primary key).
alter table incidents
  add column if not exists ref text;

update incidents
set ref = 'ACC-' || upper(substr(replace(id, '-', ''), 1, 8))
where ref is null or btrim(ref) = '';

alter table incidents
  alter column ref set not null;

create unique index if not exists incidents_ref_uidx on incidents (ref);
