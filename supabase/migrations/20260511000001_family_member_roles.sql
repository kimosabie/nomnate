alter table public.family_members
  add column if not exists relationship   text,
  add column if not exists age            int,
  add column if not exists date_of_birth  date;
