-- Wallet identity / docs on motorist + attestation expiry on policy.

alter table motorists
  add column if not exists cin text,
  add column if not exists city text,
  add column if not exists license_number text,
  add column if not exists license_photo_path text,
  add column if not exists carte_grise_photo_path text,
  add column if not exists attestation_photo_path text;

alter table policies
  add column if not exists attestation_valid_until text;
