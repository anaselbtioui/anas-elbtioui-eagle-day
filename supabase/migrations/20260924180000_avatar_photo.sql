-- Profile picture path for motorist wallet avatar.

alter table motorists
  add column if not exists avatar_photo_path text;
