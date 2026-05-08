-- Allow family members to delete shopping lists (needed for regeneration)
create policy "Family members delete shopping lists"
  on public.shopping_lists for delete
  using (
    exists (
      select 1 from public.meal_plans
      join public.family_members on family_members.family_id = meal_plans.family_id
      where meal_plans.id = shopping_lists.meal_plan_id
        and family_members.user_id = auth.uid()
    )
  );
