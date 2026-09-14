begin;
-- Tonight's only creation boundary is the atomic RPC. Preserve Phase 1 weekly policies.
create policy tonight_drafts_rpc_only on public.dinner_drafts as restrictive
  for insert to authenticated with check (draft_type <> 'tonight');
create policy tonight_candidates_insert_rpc_only on public.draft_candidates as restrictive
  for insert to authenticated with check (exists(select 1 from public.dinner_drafts d where d.id = draft_id and d.draft_type <> 'tonight'));
create policy tonight_candidates_update_rpc_only on public.draft_candidates as restrictive
  for update to authenticated using (exists(select 1 from public.dinner_drafts d where d.id = draft_id and d.draft_type <> 'tonight'))
  with check (exists(select 1 from public.dinner_drafts d where d.id = draft_id and d.draft_type <> 'tonight'));
create policy tonight_candidates_delete_rpc_only on public.draft_candidates as restrictive
  for delete to authenticated using (exists(select 1 from public.dinner_drafts d where d.id = draft_id and d.draft_type <> 'tonight'));
-- Repeat the expiry rule at the finalisation write boundary. Any preceding meal-slot
-- write in the Phase 1 RPC rolls back with this exception in the same transaction.
create function public.guard_expired_draft_finalisation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'finalised' and old.status = 'open'
    and old.expires_at is not null and old.expires_at <= now() then
    raise exception 'Draft has expired; start or join a new Dinner Draft';
  end if;
  return new;
end $$;
create trigger guard_expired_draft_finalisation before update of status on public.dinner_drafts
  for each row execute function public.guard_expired_draft_finalisation();
revoke all on function public.guard_expired_draft_finalisation() from public, anon, authenticated;

-- Selection and insertion are atomic; identity and library are resolved here.
create function public.start_dinner_draft(dinner_date date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare family uuid; draft uuid; recipes uuid[];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  family := public.active_family_id();
  if family is null then raise exception 'No active family'; end if;
  if dinner_date is null or not isfinite(dinner_date) or dinner_date < date '0001-01-01' or dinner_date > date '9999-12-31' then raise exception 'Choose a valid dinner date'; end if;
  -- Serialize starts without reversing finalisation's draft/family lock order.
  perform pg_advisory_xact_lock(hashtextextended(family::text || ':' || dinner_date::text, 0));
  select d.id into draft from public.dinner_drafts d
    where d.family_id = family and d.status = 'open' and d.draft_type = 'tonight'
      and (d.expires_at is null or d.expires_at > now())
      and exists(select 1 from public.draft_candidates c where c.draft_id = d.id
        and c.target_date = dinner_date and c.course = 'main')
    order by d.created_at, d.id limit 1;
  if draft is not null then
    -- Existing Phase 1 data is retained, but never presented as a complete slice if malformed.
    if (select count(*) from public.draft_candidates c where c.draft_id = draft) <> 3
      or exists(select 1 from public.draft_candidates c where c.draft_id = draft
        and (c.target_date is distinct from dinner_date or c.course is distinct from 'main')) then
      raise exception 'Existing draft is not a three-meal dinner decision; ask the planner to cancel it.';
    end if;
    return draft;
  end if;
  if exists(select 1 from public.meal_plan_slots s join public.meal_plans p on p.id = s.meal_plan_id
    where p.family_id = family and p.week_start_date + s.day_of_week = dinner_date
      and s.course = 'main' and (s.status = 'confirmed' or s.committed_draft_id is not null)) then
    raise exception 'A meal is already committed for this date';
  end if;
  -- Only classified mains are eligible. Least recently nominated first avoids repeat trios;
  -- favourites break equal-history ties. Family-scoped history keeps selection reproducible.
  select array_agg(id order by last_nominated nulls first, favourite desc, id) into recipes from (
    select r.id, (select max(c.created_at) from public.draft_candidates c
      join public.dinner_drafts d on d.id = c.draft_id
      where c.recipe_id = r.id and d.family_id = family) last_nominated,
      case when r.family_id = family then r.is_favourite else fr.is_favourite end favourite
    from public.recipes r left join public.family_recipes fr on fr.recipe_id = r.id and fr.family_id = family
    where (r.family_id = family or (r.family_id is null and fr.recipe_id is not null))
      and r.course = 'main'
      and length(btrim(r.title)) > 0 and length(btrim(r.instructions)) > 0
      and (r.prep_time is null or r.prep_time >= 0) and (r.cook_time is null or r.cook_time >= 0)
      and (r.servings is null or r.servings > 0)
      and exists(select 1 from public.recipe_ingredients i where i.recipe_id = r.id)
      and not exists(select 1 from public.recipe_ingredients i where i.recipe_id = r.id
        and (length(btrim(i.name)) = 0 or i.quantity < 0))
    order by last_nominated nulls first, favourite desc, r.id limit 3 for share of r
  ) eligible;
  if coalesce(cardinality(recipes), 0) <> 3 then
    raise exception 'NomNate needs at least 3 dinner ideas before we can start a Draft.';
  end if;
  insert into public.dinner_drafts(family_id, created_by, draft_type)
    values(family, auth.uid(), 'tonight') returning id into draft;
  insert into public.draft_candidates(draft_id, recipe_id, target_date, course, nomination_source, display_order)
    select draft, recipe, dinner_date, 'main', 'library', ordinal::integer - 1
    from unnest(recipes) with ordinality as selected(recipe, ordinal);
  return draft;
end $$;
revoke all on function public.start_dinner_draft(date) from public, anon;
grant execute on function public.start_dinner_draft(date) to authenticated;
commit;
