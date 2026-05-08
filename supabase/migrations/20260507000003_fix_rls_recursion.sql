-- Fix infinite recursion in family_members RLS policies.
--
-- The problem: policies on family_members checked membership by querying
-- family_members, which re-triggered those same policies → infinite loop.
--
-- The fix: security definer functions query the table as the function owner
-- (bypassing RLS), so the policies can safely call them.

create or replace function public.is_family_member(check_family_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.family_members
    where family_members.family_id = check_family_id
      and family_members.user_id = auth.uid()
  );
$$;

create or replace function public.is_family_admin(check_family_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.family_members
    where family_members.family_id = check_family_id
      and family_members.user_id = auth.uid()
      and family_members.role = 'admin'
  );
$$;

-- Recreate family_members policies using the helper functions

drop policy if exists "Members can view family membership" on public.family_members;
drop policy if exists "Admins can manage family members" on public.family_members;

create policy "Members can view family membership"
  on public.family_members for select
  using (public.is_family_member(family_id));

create policy "Admins can manage family members"
  on public.family_members for all
  using (public.is_family_admin(family_id));

-- Also tighten the other tables to use the helper (avoids any
-- secondary recursion when those policies trigger family_members RLS)

drop policy if exists "Family members can view their family" on public.families;
drop policy if exists "Family admins can update their family" on public.families;

create policy "Family members can view their family"
  on public.families for select
  using (public.is_family_member(id));

create policy "Family admins can update their family"
  on public.families for update
  using (public.is_family_admin(id));

drop policy if exists "Family members view meal plans" on public.meal_plans;
drop policy if exists "Family members create meal plans" on public.meal_plans;

create policy "Family members view meal plans"
  on public.meal_plans for select
  using (public.is_family_member(family_id));

create policy "Family members create meal plans"
  on public.meal_plans for insert
  with check (public.is_family_member(family_id));
