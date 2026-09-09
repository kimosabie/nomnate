begin;

create table public.dinner_drafts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  status text not null default 'open' check (status in ('open','finalised','cancelled')),
  draft_type text not null default 'tonight' check (draft_type in ('tonight','weekly')),
  week_start date check (week_start is null or extract(isodow from week_start) = 1),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  winner_candidate_id uuid,
  finalised_at timestamptz,
  result jsonb,
  check ((status = 'finalised' and winner_candidate_id is not null and finalised_at is not null and result is not null)
    or (status <> 'finalised' and winner_candidate_id is null and finalised_at is null and result is null))
);
create index dinner_drafts_family_status_idx on public.dinner_drafts(family_id,status,created_at);

create table public.draft_candidates (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.dinner_drafts(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id),
  target_date date,
  course text check (course is null or course in ('starter','main','dessert','side')),
  nomination_source text not null default 'planner' check (nomination_source in ('planner','library','ai')),
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  unique(draft_id,recipe_id),
  unique(draft_id,display_order),
  unique(draft_id,id)
);
alter table public.dinner_drafts add constraint dinner_draft_winner_belongs_to_draft
  foreign key(id,winner_candidate_id) references public.draft_candidates(draft_id,id)
  deferrable initially deferred;
create index draft_candidates_recipe_idx on public.draft_candidates(recipe_id);

create table public.draft_votes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.draft_candidates(id) on delete cascade,
  family_member_id uuid not null references public.family_members(id) on delete cascade,
  reaction text not null check (reaction in ('love','eat','whatever','nope')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(candidate_id,family_member_id)
);
create index draft_votes_member_idx on public.draft_votes(family_member_id);

alter table public.meal_plan_slots
  add column committed_draft_id uuid references public.dinner_drafts(id);
create unique index meal_slot_committed_decision_idx
  on public.meal_plan_slots(meal_plan_id,day_of_week,course) where committed_draft_id is not null;
create unique index meal_slot_committed_draft_idx
  on public.meal_plan_slots(committed_draft_id) where committed_draft_id is not null;

alter table public.dinner_drafts enable row level security;
alter table public.draft_candidates enable row level security;
alter table public.draft_votes enable row level security;

create policy drafts_read on public.dinner_drafts for select to authenticated
using (family_id = public.active_family_id());
create policy drafts_create on public.dinner_drafts for insert to authenticated
with check (family_id = public.active_family_id() and created_by = auth.uid() and status = 'open'
  and winner_candidate_id is null and finalised_at is null and result is null);
-- Draft state transitions are RPC-only, including result and winner fields.

create or replace function public.can_edit_draft(draft uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.dinner_drafts d where d.id = draft and d.status = 'open'
   and d.family_id = public.active_family_id()
   and (d.created_by = auth.uid() or public.is_family_admin(d.family_id)));
$$;
create or replace function public.can_react_to_candidate(candidate uuid, member uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.draft_candidates c
   join public.dinner_drafts d on d.id = c.draft_id
   join public.family_members fm on fm.family_id = d.family_id
   where c.id = candidate and fm.id = member and fm.user_id = auth.uid()
     and d.family_id = public.active_family_id() and d.status = 'open'
     and (d.expires_at is null or d.expires_at > now()));
$$;
revoke all on function public.can_edit_draft(uuid), public.can_react_to_candidate(uuid,uuid) from public, anon;
grant execute on function public.can_edit_draft(uuid), public.can_react_to_candidate(uuid,uuid) to authenticated;

create policy candidates_read on public.draft_candidates for select to authenticated
using (exists(select 1 from public.dinner_drafts d where d.id = draft_id));
create policy candidates_insert on public.draft_candidates for insert to authenticated
with check (public.can_edit_draft(draft_id) and exists(select 1 from public.recipes r
  where r.id = recipe_id and (r.family_id is null or r.family_id = public.active_family_id())));
create policy candidates_update on public.draft_candidates for update to authenticated
using (public.can_edit_draft(draft_id))
with check (public.can_edit_draft(draft_id) and exists(select 1 from public.recipes r
  where r.id = recipe_id and (r.family_id is null or r.family_id = public.active_family_id())));
create policy candidates_delete on public.draft_candidates for delete to authenticated
using (public.can_edit_draft(draft_id));

create policy draft_votes_read on public.draft_votes for select to authenticated
using (exists(select 1 from public.draft_candidates c where c.id = candidate_id));
create policy draft_votes_insert on public.draft_votes for insert to authenticated
with check (public.can_react_to_candidate(candidate_id,family_member_id));
create policy draft_votes_update on public.draft_votes for update to authenticated
using (public.can_react_to_candidate(candidate_id,family_member_id))
with check (public.can_react_to_candidate(candidate_id,family_member_id));
create policy draft_votes_delete on public.draft_votes for delete to authenticated
using (public.can_react_to_candidate(candidate_id,family_member_id));

-- Serialize candidate/vote writes on the draft row, the same lock finalisation takes.
-- Definer security permits locking draft rows without a client UPDATE policy.
-- Follow-up hardening adds explicit caller authorization inside these triggers.
create or replace function public.guard_draft_candidate()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d public.dinner_drafts; draft uuid;
begin
  draft := case when tg_op = 'DELETE' then old.draft_id else new.draft_id end;
  select * into d from public.dinner_drafts where id = draft for update;
  -- Permit cascades only when the parent is actually being removed.
  if not found and tg_op = 'DELETE' then return old; end if;
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
create trigger guard_draft_candidate before insert or update or delete on public.draft_candidates
for each row execute function public.guard_draft_candidate();

create or replace function public.guard_draft_vote()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d public.dinner_drafts; candidate uuid;
begin
  candidate := case when tg_op = 'DELETE' then old.candidate_id else new.candidate_id end;
  select dd.* into d from public.dinner_drafts dd join public.draft_candidates c on c.draft_id = dd.id
    where c.id = candidate for update of dd;
  if not found and tg_op = 'DELETE' then return old; end if;
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
create trigger guard_draft_vote before insert or update or delete on public.draft_votes
for each row execute function public.guard_draft_vote();

-- Clients cannot forge or modify authoritative commitments; the finalisation RPC owns them.
create or replace function public.guard_committed_meal()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated','anon') then
    if tg_op <> 'INSERT' and old.committed_draft_id is not null then raise exception 'Committed meals require a decision service'; end if;
    if tg_op <> 'DELETE' and new.committed_draft_id is not null then raise exception 'Use finalise_dinner_draft to commit a meal'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger guard_committed_meal before insert or update or delete on public.meal_plan_slots
for each row execute function public.guard_committed_meal();

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
  if d.created_by <> auth.uid() and not public.is_family_admin(d.family_id) then raise exception 'Only planner or family admin may finalise'; end if;
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

create or replace function public.cancel_dinner_draft(draft_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.dinner_drafts;
begin
  select * into d from public.dinner_drafts where id=draft_id for update;
  if not found or not public.can_edit_draft(d.id) then raise exception 'Cannot cancel this draft'; end if;
  update public.dinner_drafts set status='cancelled',updated_at=now() where id=d.id;
end $$;
revoke all on function public.cancel_dinner_draft(uuid) from public, anon;
grant execute on function public.cancel_dinner_draft(uuid) to authenticated;
commit;
