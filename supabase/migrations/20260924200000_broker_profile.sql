-- Broker profile fields for desk settings (name parts, phone, avatar).

alter table brokers
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone text,
  add column if not exists avatar_photo_path text;

-- Backfill first/last from display_name when missing.
update brokers
set
  first_name = case
    when first_name is not null and trim(first_name) <> '' then first_name
    when position(' ' in trim(display_name)) > 0
      then trim(split_part(trim(display_name), ' ', 1))
    else trim(display_name)
  end,
  last_name = case
    when last_name is not null and trim(last_name) <> '' then last_name
    when position(' ' in trim(display_name)) > 0
      then trim(substr(trim(display_name), position(' ' in trim(display_name)) + 1))
    else null
  end
where first_name is null or last_name is null;
