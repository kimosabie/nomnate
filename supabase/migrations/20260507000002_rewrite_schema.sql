-- Migration 002: rewrite schema to match NomNate design
-- Drops restaurant-voting tables, adds recipe/meal-planning tables

-- Drop old tables (cascade removes policies automatically)
drop table if exists public.votes cascade;
drop table if exists public.sessions cascade;
drop table if exists public.restaurants cascade;

-- Update families: add invite_code
alter table public.families
  add column invite_code text unique
    default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

-- Backfill existing rows (if any)
update public.families
  set invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  where invite_code is null;

alter table public.families
  alter column invite_code set not null;

-- Update family_members: add profile fields
alter table public.family_members
  add column name text,
  add column avatar_url text,
  add column dietary_restrictions text[] not null default '{}';

-- Update handle_new_family trigger to also regenerate invite_code on conflict
create or replace function public.handle_new_family()
returns trigger
language plpgsql security definer
as $$
begin
  insert into public.family_members (family_id, user_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end;
$$;

-- ─── Recipes ──────────────────────────────────────────────────────────────────

create table public.recipes (
  id            uuid        primary key default gen_random_uuid(),
  family_id     uuid        references public.families(id) on delete cascade,
  title         text        not null,
  source        text        not null default 'manual'
                              check (source in ('ai', 'spoonacular', 'manual')),
  instructions  text,
  image_url     text,
  prep_time     integer,    -- minutes
  cuisine       text,
  is_favourite  boolean     not null default false,
  spoonacular_id integer,
  created_by    uuid        references auth.users(id),
  created_at    timestamptz not null default now()
);

alter table public.recipes enable row level security;

-- Can read: member of the recipe's family, or family_id is null (global/imported)
create policy "View recipes"
  on public.recipes for select
  using (
    family_id is null
    or exists (
      select 1 from public.family_members
      where family_members.family_id = recipes.family_id
        and family_members.user_id = auth.uid()
    )
  );

create policy "Family members can add recipes"
  on public.recipes for insert
  with check (
    auth.uid() = created_by
    and (
      family_id is null
      or exists (
        select 1 from public.family_members
        where family_members.family_id = recipes.family_id
          and family_members.user_id = auth.uid()
      )
    )
  );

create policy "Recipe creator can update"
  on public.recipes for update
  using (auth.uid() = created_by);

create policy "Recipe creator can delete"
  on public.recipes for delete
  using (auth.uid() = created_by);

-- ─── Recipe Ingredients ────────────────────────────────────────────────────────

create table public.recipe_ingredients (
  id         uuid    primary key default gen_random_uuid(),
  recipe_id  uuid    not null references public.recipes(id) on delete cascade,
  name       text    not null,
  quantity   numeric,
  unit       text
);

alter table public.recipe_ingredients enable row level security;

create policy "View ingredients"
  on public.recipe_ingredients for select
  using (
    exists (
      select 1 from public.recipes
      where recipes.id = recipe_ingredients.recipe_id
        and (
          recipes.family_id is null
          or exists (
            select 1 from public.family_members
            where family_members.family_id = recipes.family_id
              and family_members.user_id = auth.uid()
          )
        )
    )
  );

create policy "Recipe creator manages ingredients"
  on public.recipe_ingredients for all
  using (
    exists (
      select 1 from public.recipes
      where recipes.id = recipe_ingredients.recipe_id
        and recipes.created_by = auth.uid()
    )
  );

-- ─── Meal Plans ───────────────────────────────────────────────────────────────

create table public.meal_plans (
  id              uuid  primary key default gen_random_uuid(),
  family_id       uuid  not null references public.families(id) on delete cascade,
  week_start_date date  not null,
  created_at      timestamptz not null default now(),
  unique(family_id, week_start_date)
);

alter table public.meal_plans enable row level security;

create policy "Family members view meal plans"
  on public.meal_plans for select
  using (
    exists (
      select 1 from public.family_members
      where family_members.family_id = meal_plans.family_id
        and family_members.user_id = auth.uid()
    )
  );

create policy "Family members create meal plans"
  on public.meal_plans for insert
  with check (
    exists (
      select 1 from public.family_members
      where family_members.family_id = meal_plans.family_id
        and family_members.user_id = auth.uid()
    )
  );

-- ─── Meal Plan Slots ──────────────────────────────────────────────────────────

create table public.meal_plan_slots (
  id            uuid primary key default gen_random_uuid(),
  meal_plan_id  uuid not null references public.meal_plans(id) on delete cascade,
  day_of_week   integer not null check (day_of_week between 0 and 6), -- 0=Mon, 6=Sun
  recipe_id     uuid references public.recipes(id),
  status        text not null default 'suggested'
                  check (status in ('suggested', 'voted', 'confirmed')),
  unique(meal_plan_id, day_of_week)
);

alter table public.meal_plan_slots enable row level security;

create policy "Family members view slots"
  on public.meal_plan_slots for select
  using (
    exists (
      select 1 from public.meal_plans
      join public.family_members on family_members.family_id = meal_plans.family_id
      where meal_plans.id = meal_plan_slots.meal_plan_id
        and family_members.user_id = auth.uid()
    )
  );

create policy "Family members manage slots"
  on public.meal_plan_slots for all
  using (
    exists (
      select 1 from public.meal_plans
      join public.family_members on family_members.family_id = meal_plans.family_id
      where meal_plans.id = meal_plan_slots.meal_plan_id
        and family_members.user_id = auth.uid()
    )
  );

-- ─── Votes ────────────────────────────────────────────────────────────────────

create table public.votes (
  id                 uuid primary key default gen_random_uuid(),
  meal_plan_slot_id  uuid not null references public.meal_plan_slots(id) on delete cascade,
  member_id          uuid not null references public.family_members(id) on delete cascade,
  value              text not null check (value in ('up', 'down', 'love')),
  created_at         timestamptz not null default now(),
  unique(meal_plan_slot_id, member_id)
);

alter table public.votes enable row level security;

create policy "Family members view votes"
  on public.votes for select
  using (
    exists (
      select 1 from public.meal_plan_slots mps
      join public.meal_plans mp on mp.id = mps.meal_plan_id
      join public.family_members fm on fm.family_id = mp.family_id
      where mps.id = votes.meal_plan_slot_id
        and fm.user_id = auth.uid()
    )
  );

create policy "Members cast their own votes"
  on public.votes for insert
  with check (
    exists (
      select 1 from public.family_members
      where family_members.id = votes.member_id
        and family_members.user_id = auth.uid()
    )
  );

create policy "Members update their own votes"
  on public.votes for update
  using (
    exists (
      select 1 from public.family_members
      where family_members.id = votes.member_id
        and family_members.user_id = auth.uid()
    )
  );

-- ─── Shopping Lists ───────────────────────────────────────────────────────────

create table public.shopping_lists (
  id            uuid        primary key default gen_random_uuid(),
  meal_plan_id  uuid        not null references public.meal_plans(id) on delete cascade,
  generated_at  timestamptz not null default now()
);

alter table public.shopping_lists enable row level security;

create policy "Family members view shopping lists"
  on public.shopping_lists for select
  using (
    exists (
      select 1 from public.meal_plans
      join public.family_members on family_members.family_id = meal_plans.family_id
      where meal_plans.id = shopping_lists.meal_plan_id
        and family_members.user_id = auth.uid()
    )
  );

create policy "Family members create shopping lists"
  on public.shopping_lists for insert
  with check (
    exists (
      select 1 from public.meal_plans
      join public.family_members on family_members.family_id = meal_plans.family_id
      where meal_plans.id = shopping_lists.meal_plan_id
        and family_members.user_id = auth.uid()
    )
  );

-- ─── Shopping List Items ──────────────────────────────────────────────────────

create table public.shopping_list_items (
  id               uuid    primary key default gen_random_uuid(),
  list_id          uuid    not null references public.shopping_lists(id) on delete cascade,
  ingredient_name  text    not null,
  quantity         numeric,
  unit             text,
  checked          boolean not null default false
);

alter table public.shopping_list_items enable row level security;

create policy "Family members view list items"
  on public.shopping_list_items for select
  using (
    exists (
      select 1 from public.shopping_lists sl
      join public.meal_plans mp on mp.id = sl.meal_plan_id
      join public.family_members fm on fm.family_id = mp.family_id
      where sl.id = shopping_list_items.list_id
        and fm.user_id = auth.uid()
    )
  );

create policy "Family members manage list items"
  on public.shopping_list_items for all
  using (
    exists (
      select 1 from public.shopping_lists sl
      join public.meal_plans mp on mp.id = sl.meal_plan_id
      join public.family_members fm on fm.family_id = mp.family_id
      where sl.id = shopping_list_items.list_id
        and fm.user_id = auth.uid()
    )
  );

-- ─── Realtime ─────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.meal_plan_slots;
alter publication supabase_realtime add table public.votes;
