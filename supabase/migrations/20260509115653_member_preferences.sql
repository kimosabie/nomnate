-- Add per-member meal preferences
alter table public.family_members
  add column if not exists cuisine_preferences text[] not null default '{}',
  add column if not exists ingredient_dislikes  text[] not null default '{}';

-- Allow members to update their own profile row
create policy "Members can update their own profile"
  on public.family_members for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
