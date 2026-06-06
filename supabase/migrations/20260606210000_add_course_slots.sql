-- =====================================================================
-- Migration: Structured daily course slots (B8.1)
-- =====================================================================
-- Additive + backward-compatible: existing recipes are unclassified (null),
-- existing meal_plan_slots become 'main', and families default to ['main'] so
-- the meal plan behaves exactly as before until a family opts into courses.
--
-- Apply: supabase db push
-- =====================================================================

-- 1. Recipe course classification (nullable = unclassified, allowed anywhere)
alter table public.recipes
  add column if not exists course text;

alter table public.recipes
  drop constraint if exists recipes_course_check;
alter table public.recipes
  add constraint recipes_course_check
  check (course is null or course in ('starter', 'main', 'dessert', 'side'));

create index if not exists recipes_course_idx on public.recipes (course);

-- 2. Family default courses — seeded onto each day of a new plan
alter table public.families
  add column if not exists courses text[] not null default '{main}'::text[];

-- 3. Per-slot course — which course an option belongs to
alter table public.meal_plan_slots
  add column if not exists course text not null default 'main';

alter table public.meal_plan_slots
  drop constraint if exists meal_plan_slots_course_check;
alter table public.meal_plan_slots
  add constraint meal_plan_slots_course_check
  check (course in ('starter', 'main', 'dessert', 'side'));

-- existing slots are the pre-B8 dinner contest
update public.meal_plan_slots set course = 'main' where course is null;

-- 4. Comments
comment on column public.recipes.course is
  'starter|main|dessert|side — drives course-slot filtering (B8). null = unclassified, allowed in any slot.';
comment on column public.families.courses is
  'Default courses seeded onto each day of a new meal plan. Per-day courses are presence-based on meal_plan_slots.';
comment on column public.meal_plan_slots.course is
  'starter|main|dessert|side — which course this option belongs to. Default main (the pre-B8 dinner contest).';
