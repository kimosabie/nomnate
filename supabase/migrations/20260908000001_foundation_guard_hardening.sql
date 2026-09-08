-- Follow-up to the recovered Foundation migrations; no historical migrations are rewritten.
begin;

-- Older permissive vote policies could have admitted a member from a different
-- family than the slot. Keep those rows for manual audit, but never expose them
-- through a visible slot. New writes already require matching family ownership.
alter policy votes_read on public.votes using (
  exists (
    select 1 from public.meal_plan_slots ms
    join public.meal_plans mp on mp.id = ms.meal_plan_id
    join public.family_members fm on fm.family_id = mp.family_id
    where ms.id = votes.meal_plan_slot_id and fm.id = votes.member_id
  )
);

-- Definer is required to lock draft rows: authenticated users deliberately have no
-- UPDATE policy on dinner_drafts. Explicit authorization follows the lock, so a
-- concurrent finalisation cannot be bypassed using an earlier RLS snapshot.
create or replace function public.guard_draft_candidate()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d public.dinner_drafts; draft uuid;
begin
  draft := case when tg_op = 'DELETE' then old.draft_id else new.draft_id end;
  select * into d from public.dinner_drafts where id = draft for update;
  -- Permit cascades only when the parent is actually being removed.
  if not found and tg_op = 'DELETE' then return old; end if;
  if auth.uid() is null or not public.can_edit_draft(draft) then raise exception 'Candidate outside editable active-family draft'; end if;
  if d.status <> 'open' then raise exception 'Draft is not open'; end if;
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.draft_id <> old.draft_id then raise exception 'Candidate identity is immutable'; end if;
    if (new.recipe_id <> old.recipe_id or new.target_date is distinct from old.target_date or new.course is distinct from old.course)
      and exists(select 1 from public.draft_votes where candidate_id = old.id) then
      raise exception 'Cannot change a candidate after reactions have been cast';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create or replace function public.guard_draft_vote()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d public.dinner_drafts; candidate uuid;
begin
  candidate := case when tg_op = 'DELETE' then old.candidate_id else new.candidate_id end;
  select dd.* into d from public.dinner_drafts dd join public.draft_candidates c on c.draft_id = dd.id
    where c.id = candidate for update of dd;
  if not found and tg_op = 'DELETE' then return old; end if;
  -- FK cascades are permitted only after their member or candidate has disappeared.
  if tg_op = 'DELETE' and not exists(select 1 from public.family_members where id = old.family_member_id) then return old; end if;
  if auth.uid() is null or not public.can_react_to_candidate(candidate, case when tg_op = 'DELETE' then old.family_member_id else new.family_member_id end) then
    raise exception 'Reaction outside open active-family draft';
  end if;
  if d.status <> 'open' or (d.expires_at is not null and d.expires_at <= now()) then
    -- Auth-user/family cascades must not be blocked by closed-draft reaction rows.
    if tg_op = 'DELETE' and not exists(select 1 from public.family_members where id = old.family_member_id) then return old; end if;
    raise exception 'Draft is closed for reactions';
  end if;
  if tg_op = 'UPDATE' and (new.id <> old.id or new.candidate_id <> old.candidate_id or new.family_member_id <> old.family_member_id) then
    raise exception 'Vote identity is immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := now();
  return new;
end $$;

-- Invoker security is required here: current_user distinguishes client writes
-- from the owner-executed finalisation RPC. Protect legacy confirmed meals too.
create or replace function public.guard_committed_meal()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated','anon') then
    if tg_op <> 'INSERT' and (old.committed_draft_id is not null or old.status = 'confirmed') then raise exception 'Committed meals require a decision service'; end if;
    if tg_op <> 'DELETE' and (new.committed_draft_id is not null or new.status = 'confirmed') then raise exception 'Use finalise_dinner_draft to commit a meal'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- Trigger functions are not public RPC entry points. Existing triggers continue
-- to run; authorization is checked in the functions as well as row policies.
revoke all on function public.guard_draft_candidate(), public.guard_draft_vote(),
  public.guard_committed_meal(), public.guard_member_identity(), public.guard_meal_vote()
  from public, anon, authenticated;

-- Explicit creator authorization in the privileged membership-creation trigger.
create or replace function public.handle_new_family()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or new.created_by is distinct from auth.uid() then
    raise exception 'Family creator must be the authenticated caller';
  end if;
  insert into public.family_members(family_id,user_id,role)
    values(new.id,auth.uid(),'admin');
  return new;
end $$;
revoke all on function public.handle_new_family() from public, anon, authenticated;

create or replace function public.get_family_by_invite_code(code text)
returns table(id uuid,name text) language sql stable security definer set search_path = '' as $$
  select f.id,f.name from public.families f
    where auth.uid() is not null and f.invite_code = upper(trim(code)) limit 1;
$$;
revoke all on function public.get_family_by_invite_code(text) from public, anon;
grant execute on function public.get_family_by_invite_code(text) to authenticated;
-- Validate nullable RPC inputs explicitly; SQL NULL must not bypass IF checks.
create or replace function public.join_family(code text, display_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare family uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if code is null or length(trim(code)) = 0 then raise exception 'Invalid invite code'; end if;
  if display_name is null or length(trim(display_name)) not between 1 and 60 then
    raise exception 'Invalid display name';
  end if;
  select f.id into family from public.families f where f.invite_code = upper(trim(code));
  if family is null then raise exception 'Invalid invite code'; end if;
  insert into public.family_members(family_id,user_id,name,role)
    values(family,auth.uid(),trim(display_name),'member')
    on conflict(family_id,user_id) do nothing;
  return family;
end $$;
revoke all on function public.join_family(text,text) from public, anon;
grant execute on function public.join_family(text,text) to authenticated;
commit;
