-- =====================================================================
-- Migration: Food log entries (B7.2)
-- =====================================================================
-- Per-member daily food diary. Nutrition is snapshotted onto each row at log
-- time so editing/deleting a recipe never rewrites diary history. Owner-only RLS
-- (a food diary is personal — not family-visible), mirroring the votes pattern.
--
-- Apply: supabase db push
-- =====================================================================

create table if not exists public.food_log_entries (
  id                  uuid primary key default gen_random_uuid(),
  family_member_id    uuid not null references public.family_members(id) on delete cascade,
  logged_date         date not null,
  meal_type           text check (meal_type is null or meal_type in ('breakfast','lunch','dinner','snack')),
  recipe_id           uuid references public.recipes(id) on delete set null,
  label               text not null,
  servings            numeric not null default 1 check (servings > 0),
  calories            integer,
  protein_g           integer,
  carbs_g             integer,
  fat_g               integer,
  nutrition_estimated boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists food_log_entries_member_date_idx
  on public.food_log_entries (family_member_id, logged_date);

alter table public.food_log_entries enable row level security;

-- Owner-only: the entry's family_member belongs to the calling user.
create policy "Members view their own food log"
  on public.food_log_entries for select
  using (
    exists (
      select 1 from public.family_members
      where family_members.id = food_log_entries.family_member_id
        and family_members.user_id = auth.uid()
    )
  );

create policy "Members add their own food log entries"
  on public.food_log_entries for insert
  with check (
    exists (
      select 1 from public.family_members
      where family_members.id = food_log_entries.family_member_id
        and family_members.user_id = auth.uid()
    )
  );

create policy "Members delete their own food log entries"
  on public.food_log_entries for delete
  using (
    exists (
      select 1 from public.family_members
      where family_members.id = food_log_entries.family_member_id
        and family_members.user_id = auth.uid()
    )
  );

comment on table public.food_log_entries is
  'Per-member daily food diary (B7). Nutrition snapshotted at log time; owner-only RLS.';
