-- Foundation: additive schema reconciliation and explicit authenticated mutation boundaries.
-- No data deletion. Apply only after reviewing against the deployed schema.
begin;

-- Existing application columns missing from the historical migration chain.
alter table public.families add column if not exists preferred_stores text[] not null default '{}';
alter table public.families alter column country set default 'ZA';
alter table public.family_members
  add column if not exists allergies text[] not null default '{}',
  add column if not exists liked_ingredients text[] not null default '{}',
  add column if not exists diet_types text[] not null default '{}',
  add column if not exists daily_calorie_target integer,
  add column if not exists track_calories boolean not null default false;
alter table public.recipes
  add column if not exists description text,
  add column if not exists cook_time integer,
  add column if not exists servings integer,
  add column if not exists diet_types text[] not null default '{}',
  add column if not exists calories_per_serving integer,
  add column if not exists protein_g integer,
  add column if not exists carbs_g integer,
  add column if not exists fat_g integer;
alter table public.shopping_list_items add column if not exists store text;

-- Existing app has no family switcher. Make its first-membership convention deterministic.
create or replace function public.active_family_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select fm.family_id from public.family_members fm
  where fm.user_id = auth.uid() order by fm.joined_at, fm.id limit 1;
$$;
create or replace function public.is_family_member(check_family_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.family_members fm
    where fm.family_id = check_family_id and fm.user_id = auth.uid());
$$;
create or replace function public.is_family_admin(check_family_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.family_members fm
    where fm.family_id = check_family_id and fm.user_id = auth.uid() and fm.role = 'admin');
$$;
revoke all on function public.active_family_id() from public, anon;
grant execute on function public.active_family_id() to authenticated;
revoke all on function public.is_family_member(uuid), public.is_family_admin(uuid) from public, anon;
grant execute on function public.is_family_member(uuid), public.is_family_admin(uuid) to authenticated;

-- Explicitly remove old permissive policies; adding restrictive-looking policies alone is insufficient.
do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in
      ('family_members','meal_plans','meal_plan_slots','votes','shopping_lists','shopping_list_items')
  loop execute format('drop policy %I on public.%I', p.policyname, p.tablename); end loop;
end $$;

create policy membership_read on public.family_members for select to authenticated
using (public.is_family_member(family_id));
create policy membership_profile_update on public.family_members for update to authenticated
using (family_id = public.active_family_id() and (user_id = auth.uid() or public.is_family_admin(family_id)))
with check (family_id = public.active_family_id() and (user_id = auth.uid() or public.is_family_admin(family_id)));
create policy membership_admin_delete on public.family_members for delete to authenticated
using (family_id = public.active_family_id() and public.is_family_admin(family_id) and user_id <> auth.uid());

create or replace function public.guard_member_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.user_id <> old.user_id or new.family_id <> old.family_id
     or new.joined_at <> old.joined_at then
    raise exception 'Membership identity is immutable';
  end if;
  if new.role <> old.role and not public.is_family_admin(old.family_id) then
    raise exception 'Only family admins may change roles';
  end if;
  return new;
end $$;
create trigger guard_member_identity before update on public.family_members
for each row execute function public.guard_member_identity();

-- No direct INSERT policy: membership may only be created by the family trigger or validated join RPC.
create or replace function public.join_family(code text, display_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare family uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(display_name)) not between 1 and 60 then raise exception 'Invalid display name'; end if;
  select f.id into family from public.families f where f.invite_code = upper(trim(code));
  if family is null then raise exception 'Invalid invite code'; end if;
  insert into public.family_members(family_id, user_id, name, role)
    values (family, auth.uid(), trim(display_name), 'member')
    on conflict (family_id, user_id) do nothing;
  return family;
end $$;
revoke all on function public.join_family(text,text) from public, anon;
grant execute on function public.join_family(text,text) to authenticated;
-- Keep the legacy lookup authenticated-only; membership still requires join_family.
revoke all on function public.get_family_by_invite_code(text) from public, anon;
grant execute on function public.get_family_by_invite_code(text) to authenticated;
alter function public.get_family_by_invite_code(text) set search_path = public, pg_temp;
alter function public.handle_new_family() set search_path = public, pg_temp;

create policy plans_read on public.meal_plans for select to authenticated
using (public.is_family_member(family_id));
create policy plans_insert on public.meal_plans for insert to authenticated
with check (family_id = public.active_family_id());

create or replace function public.active_plan(plan uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.meal_plans mp where mp.id = plan and mp.family_id = public.active_family_id());
$$;
create or replace function public.active_list(list uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.shopping_lists sl where sl.id = list and public.active_plan(sl.meal_plan_id));
$$;
revoke all on function public.active_plan(uuid), public.active_list(uuid) from public, anon;
grant execute on function public.active_plan(uuid), public.active_list(uuid) to authenticated;

create policy slots_active_family on public.meal_plan_slots for all to authenticated
using (public.active_plan(meal_plan_id))
with check (public.active_plan(meal_plan_id) and
  (recipe_id is null or exists(select 1 from public.recipes r where r.id = recipe_id
    and (r.family_id is null or r.family_id = public.active_family_id()))));

create or replace function public.can_vote_slot(slot uuid, member uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.family_members fm
   join public.meal_plans mp on mp.family_id = fm.family_id
   join public.meal_plan_slots ms on ms.meal_plan_id = mp.id
   where fm.id = member and fm.user_id = auth.uid() and ms.id = slot
     and fm.family_id = public.active_family_id());
$$;
revoke all on function public.can_vote_slot(uuid,uuid) from public, anon;
grant execute on function public.can_vote_slot(uuid,uuid) to authenticated;
create policy votes_read on public.votes for select to authenticated
using (exists(select 1 from public.meal_plan_slots ms where ms.id = meal_plan_slot_id));
create policy votes_insert on public.votes for insert to authenticated
with check (public.can_vote_slot(meal_plan_slot_id, member_id));
create policy votes_update on public.votes for update to authenticated
using (public.can_vote_slot(meal_plan_slot_id, member_id))
with check (public.can_vote_slot(meal_plan_slot_id, member_id));
create policy votes_delete on public.votes for delete to authenticated
using (public.can_vote_slot(meal_plan_slot_id, member_id));

create policy lists_read on public.shopping_lists for select to authenticated
using (public.active_plan(meal_plan_id));
create policy lists_insert on public.shopping_lists for insert to authenticated
with check (public.active_plan(meal_plan_id));
create policy lists_delete on public.shopping_lists for delete to authenticated
using (public.active_plan(meal_plan_id));
create policy list_items_active_family on public.shopping_list_items for all to authenticated
using (public.active_list(list_id)) with check (public.active_list(list_id));

-- Legacy calendar and mobile must enforce the same per-course choice at the DB boundary.
create or replace function public.guard_meal_vote()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target public.meal_plan_slots;
begin
  if tg_op = 'UPDATE' and (new.member_id <> old.member_id or new.meal_plan_slot_id <> old.meal_plan_slot_id) then
    raise exception 'Vote identity is immutable';
  end if;
  if not public.can_vote_slot(new.meal_plan_slot_id, new.member_id) then raise exception 'Vote outside active family'; end if;
  perform 1 from public.family_members where id = new.member_id for update;
  select * into target from public.meal_plan_slots where id = new.meal_plan_slot_id;
  if target.recipe_id is null then raise exception 'Cannot vote on an empty slot'; end if;
  if exists(select 1 from public.votes v join public.meal_plan_slots ms on ms.id = v.meal_plan_slot_id
    where v.member_id = new.member_id and v.meal_plan_slot_id <> new.meal_plan_slot_id
      and ms.meal_plan_id = target.meal_plan_id and ms.day_of_week = target.day_of_week and ms.course = target.course)
    then raise exception 'One vote per member per day and course'; end if;
  return new;
end $$;
create trigger guard_meal_vote before insert or update on public.votes
for each row execute function public.guard_meal_vote();
commit;
