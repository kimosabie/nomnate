-- =====================================================================
-- Migration: Flag estimated recipe nutrition (B7.1)
-- =====================================================================
-- When a recipe's calories/macros are filled by Spoonacular guessNutrition or an
-- AI estimate (rather than a real source like Spoonacular's measured nutrition),
-- mark them as approximate so the UI can show a "~". Additive, default false.
--
-- Apply: supabase db push
-- =====================================================================

alter table public.recipes
  add column if not exists nutrition_estimated boolean not null default false;

comment on column public.recipes.nutrition_estimated is
  'true when calories/macros were estimated (Spoonacular guessNutrition or AI), not from a measured source. Show as approximate.';
