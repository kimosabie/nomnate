-- Fix two onboarding RLS gaps:
--
-- 1. createFamily: the INSERT...RETURNING on families evaluates the SELECT
--    policy (is_family_member) before the trigger has added the creator to
--    family_members, so RETURNING sees no visible row and raises an RLS error.
--    Fix: let the creator see their own family via created_by = auth.uid().
--
-- 2. joinFamily: non-members have no SELECT access on families so they can't
--    look up an invite code. Fix: security-definer RPC that does the lookup.
--    Also: no INSERT policy exists for a non-admin user to join family_members.

-- ── 1. Families SELECT: creator can always see their own family ───────────────

drop policy if exists "Family members can view their family" on public.families;
drop policy if exists "Family members or creator can view family" on public.families;
drop policy if exists "Authenticated users can view families" on public.families;

create policy "Family members or creator can view family"
  on public.families for select
  using (
    auth.uid() = created_by
    or public.is_family_member(id)
  );

-- ── 2. RPC: look up a family by invite code (bypasses RLS) ───────────────────

create or replace function public.get_family_by_invite_code(code text)
returns table (id uuid, name text)
language sql
security definer
stable
as $$
  select id, name
  from public.families
  where invite_code = upper(trim(code))
  limit 1;
$$;

-- ── 3. Allow any authenticated user to join a family (insert themselves) ──────

create policy "Users can join a family"
  on public.family_members for insert
  with check (auth.uid() = user_id);
