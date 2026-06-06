-- =====================================================================
-- Migration: Course-aware option uniqueness (B8.3)
-- =====================================================================
-- The previous unique key (meal_plan_id, day_of_week, option_number) prevented
-- two courses from sharing an option_number on the same day. Now that a day can
-- hold multiple courses (starter/main/dessert), uniqueness must include course.
--
-- Safe + backward-compatible: existing rows are all course='main' and were unique
-- under the old key, so they remain unique under the wider key.
--
-- Apply: supabase db push
-- =====================================================================

alter table public.meal_plan_slots
  drop constraint if exists meal_plan_slots_plan_day_option_key;

alter table public.meal_plan_slots
  add constraint meal_plan_slots_plan_day_course_option_key
    unique (meal_plan_id, day_of_week, course, option_number);
