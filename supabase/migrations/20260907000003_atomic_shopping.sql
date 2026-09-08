begin;
-- Invoker-security retains active-family RLS, with all writes in one transaction.
create or replace function public.replace_shopping_list(plan_id uuid, items jsonb)
returns uuid language plpgsql set search_path = '' as $$
declare list uuid;
begin
  if auth.uid() is null or not public.active_plan(plan_id) then raise exception 'Plan outside active family'; end if;
  if items is null or jsonb_typeof(items) <> 'array' then raise exception 'Invalid shopping items'; end if;
  if jsonb_array_length(items) > 2000 then raise exception 'Too many shopping items'; end if;
  perform pg_advisory_xact_lock(hashtextextended(plan_id::text, 0));
  delete from public.shopping_lists where meal_plan_id = plan_id;
  insert into public.shopping_lists(meal_plan_id) values(plan_id) returning id into list;
  insert into public.shopping_list_items(list_id,ingredient_name,quantity,unit)
    select list, i.ingredient_name, i.quantity, i.unit
    from jsonb_to_recordset(items) as i(ingredient_name text,quantity numeric,unit text);
  return list;
end $$;
revoke all on function public.replace_shopping_list(uuid,jsonb) from public, anon;
grant execute on function public.replace_shopping_list(uuid,jsonb) to authenticated;
commit;
