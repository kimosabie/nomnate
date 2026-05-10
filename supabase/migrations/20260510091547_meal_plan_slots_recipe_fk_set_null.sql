-- Change meal_plan_slots.recipe_id FK to SET NULL on recipe delete
-- Allows deleting recipes without breaking existing meal plan slots

ALTER TABLE public.meal_plan_slots
  DROP CONSTRAINT meal_plan_slots_recipe_id_fkey;

ALTER TABLE public.meal_plan_slots
  ADD CONSTRAINT meal_plan_slots_recipe_id_fkey
    FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE SET NULL;
