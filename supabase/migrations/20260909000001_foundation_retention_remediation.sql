-- Bounded pre-merge retention and account-deletion remediation.
begin;

alter table public.dinner_drafts
  alter column created_by drop not null,
  drop constraint dinner_drafts_created_by_fkey,
  add constraint dinner_drafts_created_by_fkey foreign key(created_by) references auth.users(id) on delete set null;

-- These existing nullable audit references must also permit auth-user deletion.
alter table public.recipes drop constraint recipes_created_by_fkey,
  add constraint recipes_created_by_fkey foreign key(created_by) references auth.users(id) on delete set null;
alter table public.family_recipes drop constraint family_recipes_added_by_fkey,
  add constraint family_recipes_added_by_fkey foreign key(added_by) references auth.users(id) on delete set null;
alter table public.events drop constraint events_created_by_fkey,
  add constraint events_created_by_fkey foreign key(created_by) references auth.users(id) on delete set null;

-- Trusted succession may promote a replacement; ordinary clients retain the admin check.
create or replace function public.guard_member_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.user_id <> old.user_id or new.family_id <> old.family_id
     or new.joined_at <> old.joined_at then
    raise exception 'Membership identity is immutable';
  end if;
  if new.role <> old.role and current_user in ('authenticated','anon') and not public.is_family_admin(old.family_id) then
    raise exception 'Only family admins may change roles';
  end if;
  return new;
end $$;

-- Runs inside the database transaction used to delete auth.users, not as a
-- separate application request. Any failed SQL deletion rolls succession back.
-- This does not make the external Auth HTTP request a distributed transaction.
create or replace function public.succeed_deleted_family_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare family uuid; successor uuid;
begin
  for family in select id from public.families where created_by = old.id order by id for update loop
    select fm.user_id into successor from public.family_members fm
      where fm.family_id = family and fm.user_id <> old.id
      order by (fm.role = 'admin') desc, fm.joined_at, fm.id limit 1 for update;
    if successor is not null then
      update public.family_members set role = 'admin' where family_id = family and user_id = successor;
      update public.families set created_by = successor where id = family;
    end if;
    -- No remaining member: retain the existing family ON DELETE CASCADE behavior.
  end loop;
  return old;
end $$;
revoke all on function public.succeed_deleted_family_owner() from public, anon, authenticated;
create trigger succeed_deleted_family_owner before delete on auth.users
  for each row execute function public.succeed_deleted_family_owner();

-- SQL NULL must never bypass creator/admin authorization.
create or replace function public.finalise_dinner_draft(draft_id uuid, expected_winner uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d public.dinner_drafts;
  winner public.draft_candidates;
  results jsonb;
  top_score bigint;
  leaders uuid[];
  total_votes bigint;
  plan uuid;
  slot uuid;
  week date;
  dow integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into d from public.dinner_drafts where id = draft_id for update;
  if not found or d.family_id is distinct from public.active_family_id() then raise exception 'Draft outside active family'; end if;
  if d.created_by is distinct from auth.uid() and not public.is_family_admin(d.family_id) then raise exception 'Only planner or family admin may finalise'; end if;
  if d.status <> 'open' then raise exception 'Draft is not open'; end if;

  -- Score every candidate, including unreacted candidates. No ordering-based tie break.
  select jsonb_agg(jsonb_build_object('candidateId',s.id,'score',s.score,'voteCount',s.n,
    'reactions',jsonb_build_object('love',s.love,'eat',s.eat,'whatever',s.whatever,'nope',s.nope)) order by s.id),
    max(s.score), coalesce(sum(s.n),0)
  into results, top_score, total_votes
  from (
    select c.id, coalesce(sum(case v.reaction when 'love' then 3 when 'eat' then 1 when 'nope' then -3 else 0 end),0) score,
      count(v.id) n, count(v.id) filter(where v.reaction='love') love,
      count(v.id) filter(where v.reaction='eat') eat, count(v.id) filter(where v.reaction='whatever') whatever,
      count(v.id) filter(where v.reaction='nope') nope
    from public.draft_candidates c left join public.draft_votes v on v.candidate_id = c.id
    where c.draft_id = d.id group by c.id
  ) s;
  if results is null then raise exception 'Draft has no candidates'; end if;
  if total_votes = 0 then raise exception 'Draft has no votes'; end if;
  select array_agg((r->>'candidateId')::uuid) into leaders
    from jsonb_array_elements(results) r where (r->>'score')::bigint = top_score;
  if cardinality(leaders) <> 1 then raise exception 'Draft has an unresolved tie'; end if;
  if expected_winner is distinct from leaders[1] then raise exception 'Draft results changed; refresh and retry'; end if;
  select * into winner from public.draft_candidates where id = leaders[1];

  -- One decision per draft. Refuse mixed weekly contests rather than silently discarding meals.
  if exists(select 1 from public.draft_candidates c where c.draft_id = d.id
    and (c.target_date is distinct from winner.target_date or coalesce(c.course,'main') <> coalesce(winner.course,'main'))) then
    raise exception 'Phase 1 drafts must target one date and course';
  end if;
  if not exists(select 1 from public.recipes r where r.id = winner.recipe_id
    and (r.family_id is null or r.family_id = d.family_id)) then raise exception 'Winning recipe is unavailable to this family'; end if;

  if winner.target_date is not null then
    week := winner.target_date - (extract(isodow from winner.target_date)::integer - 1);
    if d.week_start is not null and d.week_start <> week then raise exception 'Candidate date is outside the draft week'; end if;
    dow := extract(isodow from winner.target_date)::integer - 1;
    -- Family lock also serializes different drafts committing to the same day.
    perform 1 from public.families where id = d.family_id for update;
    insert into public.meal_plans(family_id,week_start_date) values(d.family_id,week)
      on conflict(family_id,week_start_date) do nothing;
    select id into plan from public.meal_plans where family_id = d.family_id and week_start_date = week for update;
    if exists(select 1 from public.meal_plan_slots ms where ms.meal_plan_id = plan and ms.day_of_week = dow
      and ms.course = coalesce(winner.course,'main') and (ms.status = 'confirmed' or ms.committed_draft_id is not null)) then
      raise exception 'A meal is already committed for this date and course';
    end if;
    -- Preserve competing options; replace option 1 only, and discard its old recipe-specific votes.
    select id into slot from public.meal_plan_slots where meal_plan_id = plan and day_of_week = dow
      and course = coalesce(winner.course,'main') and option_number = 1 for update;
    if slot is null then
      insert into public.meal_plan_slots(meal_plan_id,day_of_week,course,option_number,recipe_id,status,committed_draft_id)
        values(plan,dow,coalesce(winner.course,'main'),1,winner.recipe_id,'confirmed',d.id) returning id into slot;
    else
      delete from public.votes where meal_plan_slot_id = slot;
      update public.meal_plan_slots set recipe_id = winner.recipe_id,status = 'confirmed',committed_draft_id = d.id where id = slot;
    end if;
  end if;

  results := jsonb_build_object('winner',winner.id,'scores',results,'voteCount',total_votes,
    'tied',false,'tiedCandidateIds','[]'::jsonb,'committedSlotId',slot);
  update public.dinner_drafts set status='finalised',winner_candidate_id=winner.id,
    result=results,finalised_at=now(),updated_at=now() where id=d.id;
  return results;
end $$;
revoke all on function public.finalise_dinner_draft(uuid,uuid) from public, anon;
grant execute on function public.finalise_dinner_draft(uuid,uuid) to authenticated;


-- Snapshot existing candidates before installing the updated write guard.
-- New snapshots capture nomination/replacement time; backfill captures migration time.
alter table public.draft_candidates add column recipe_snapshot jsonb default '{}'::jsonb;
alter table public.draft_candidates disable trigger guard_draft_candidate;
update public.draft_candidates c set recipe_snapshot = (to_jsonb(r) - 'created_by') || jsonb_build_object('ingredients', coalesce(
  (select jsonb_agg(to_jsonb(i) order by i.id) from public.recipe_ingredients i where i.recipe_id = r.id), '[]'::jsonb))
  from public.recipes r where r.id = c.recipe_id;
alter table public.draft_candidates enable trigger guard_draft_candidate;
alter table public.draft_candidates
  alter column recipe_snapshot set not null,
  alter column recipe_id drop not null,
  drop constraint draft_candidates_recipe_id_fkey,
  add constraint draft_candidates_recipe_id_fkey foreign key(recipe_id) references public.recipes(id) on delete set null;

create or replace function public.guard_draft_candidate()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d public.dinner_drafts; draft uuid;
begin
  draft := case when tg_op = 'DELETE' then old.draft_id else new.draft_id end;
  select * into d from public.dinner_drafts where id = draft for update;
  -- Permit cascades only when the parent is actually being removed.
  if not found and tg_op = 'DELETE' then return old; end if;
  -- Only the FK action after a recipe disappears may detach a cancelled reference.
  -- Also permit family cascades after the owning family actually disappears.
  -- Preserve the entire candidate and snapshot, including its ID and reactions.
  if tg_op = 'UPDATE' and (d.status = 'cancelled'
    or not exists(select 1 from public.families where id = d.family_id))
    and old.recipe_id is not null and new.recipe_id is null
    and (to_jsonb(new) - 'recipe_id') = (to_jsonb(old) - 'recipe_id')
    and not exists(select 1 from public.recipes where id = old.recipe_id) then
    return new;
  end if;
  if auth.uid() is null or not public.can_edit_draft(draft) then raise exception 'Candidate outside editable active-family draft'; end if;
  if d.status <> 'open' then raise exception 'Draft is not open'; end if;
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.draft_id <> old.draft_id then raise exception 'Candidate identity is immutable'; end if;
    if (new.recipe_id is distinct from old.recipe_id or new.target_date is distinct from old.target_date or new.course is distinct from old.course)
      and exists(select 1 from public.draft_votes where candidate_id = old.id) then
      raise exception 'Cannot change a candidate after reactions have been cast';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if tg_op = 'INSERT' or new.recipe_id is distinct from old.recipe_id then
    select (to_jsonb(r) - 'created_by') || jsonb_build_object('ingredients', coalesce(
      (select jsonb_agg(to_jsonb(i) order by i.id) from public.recipe_ingredients i where i.recipe_id = r.id), '[]'::jsonb))
      into new.recipe_snapshot from public.recipes r where r.id = new.recipe_id;
  else
    new.recipe_snapshot := old.recipe_snapshot;
  end if;
  return new;
end $$;


commit;
