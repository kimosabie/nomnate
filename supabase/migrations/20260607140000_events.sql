-- =====================================================================
-- Migration: Braai / party event planner (B12.1)
-- =====================================================================
-- Family-scoped events with a course-grouped menu of dishes (each a real recipe
-- so the shopping list has ingredients). RLS mirrors meal_plans / meal_plan_slots.
--
-- Apply: supabase db push
-- =====================================================================

create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families(id) on delete cascade,
  name         text not null,
  event_type   text check (event_type is null or event_type in ('braai', 'party', 'dinner', 'other')),
  event_date   date,
  guest_count  integer not null default 4 check (guest_count > 0),
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

create index if not exists events_family_idx on public.events (family_id);

alter table public.events enable row level security;

create policy "Family members view events"
  on public.events for select
  using (
    exists (
      select 1 from public.family_members
      where family_members.family_id = events.family_id
        and family_members.user_id = auth.uid()
    )
  );

create policy "Family members create events"
  on public.events for insert
  with check (
    exists (
      select 1 from public.family_members
      where family_members.family_id = events.family_id
        and family_members.user_id = auth.uid()
    )
  );

create policy "Family members update events"
  on public.events for update
  using (
    exists (
      select 1 from public.family_members
      where family_members.family_id = events.family_id
        and family_members.user_id = auth.uid()
    )
  );

create policy "Family members delete events"
  on public.events for delete
  using (
    exists (
      select 1 from public.family_members
      where family_members.family_id = events.family_id
        and family_members.user_id = auth.uid()
    )
  );

-- ─── Event dishes (the menu) ──────────────────────────────────────────────────

create table if not exists public.event_dishes (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  recipe_id   uuid references public.recipes(id) on delete set null,
  course      text not null default 'main' check (course in ('starter', 'main', 'dessert', 'side')),
  label       text not null,
  created_at  timestamptz not null default now()
);

create index if not exists event_dishes_event_idx on public.event_dishes (event_id);

alter table public.event_dishes enable row level security;

create policy "Family members view event dishes"
  on public.event_dishes for select
  using (
    exists (
      select 1 from public.events
      join public.family_members on family_members.family_id = events.family_id
      where events.id = event_dishes.event_id
        and family_members.user_id = auth.uid()
    )
  );

create policy "Family members manage event dishes"
  on public.event_dishes for all
  using (
    exists (
      select 1 from public.events
      join public.family_members on family_members.family_id = events.family_id
      where events.id = event_dishes.event_id
        and family_members.user_id = auth.uid()
    )
  );

comment on table public.events is 'Braai/party events (B12) — family-scoped, with a course-grouped dish menu.';
comment on table public.event_dishes is 'Dishes on an event menu; recipe_id links a real recipe so the shopping list has ingredients.';
