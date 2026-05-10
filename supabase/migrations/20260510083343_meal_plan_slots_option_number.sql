-- Add option_number to meal_plan_slots to support 3 recipe options per day
-- Existing rows get option_number = 1 (the default)

ALTER TABLE public.meal_plan_slots
  ADD COLUMN IF NOT EXISTS option_number integer NOT NULL DEFAULT 1
    CHECK (option_number BETWEEN 1 AND 3);

-- Replace single-day uniqueness with per-option uniqueness
ALTER TABLE public.meal_plan_slots
  DROP CONSTRAINT IF EXISTS meal_plan_slots_meal_plan_id_day_of_week_key;

ALTER TABLE public.meal_plan_slots
  ADD CONSTRAINT meal_plan_slots_plan_day_option_key
    UNIQUE (meal_plan_id, day_of_week, option_number);
