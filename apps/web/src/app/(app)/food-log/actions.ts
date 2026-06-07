"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { filterText } from "@/lib/contentFilter";

export type LogEntry = {
  id: string;
  logged_date: string;
  meal_type: string | null;
  recipe_id: string | null;
  label: string;
  servings: number;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  nutrition_estimated: boolean;
};

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

function cleanMealType(value: unknown): string | null {
  const v = typeof value === "string" ? value.toLowerCase().trim() : "";
  return MEAL_TYPES.includes(v) ? v : null;
}

function cleanDate(value: unknown): string {
  const v = typeof value === "string" ? value : "";
  // Accept YYYY-MM-DD only; otherwise today (UTC).
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : new Date().toISOString().slice(0, 10);
}

function cleanServings(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(Math.round(n * 100) / 100, 50);
}

async function resolveMember(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: member } = await supabase
    .from("family_members")
    .select("id, family_id, daily_calorie_target, track_calories")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  return member ?? null;
}

// Entries for the logged-in member on a date, plus their target/preference.
export async function getDayLog(
  date: string
): Promise<{ error: string } | { entries: LogEntry[]; target: number | null; trackCalories: boolean }> {
  const supabase = await createClient();
  const member = await resolveMember(supabase);
  if (!member) return { error: "No family found" };

  const day = cleanDate(date);
  const { data, error } = await supabase
    .from("food_log_entries")
    .select("id, logged_date, meal_type, recipe_id, label, servings, calories, protein_g, carbs_g, fat_g, nutrition_estimated")
    .eq("family_member_id", member.id)
    .eq("logged_date", day)
    .order("created_at", { ascending: true });
  if (error) return { error: error.message };

  return {
    entries: (data ?? []) as LogEntry[],
    target: member.daily_calorie_target ?? null,
    trackCalories: member.track_calories,
  };
}

export async function addLogEntryFromRecipe(input: {
  recipeId: string;
  date: string;
  mealType?: string | null;
  servings?: number;
}): Promise<{ error: string } | { entry: LogEntry }> {
  const supabase = await createClient();
  const member = await resolveMember(supabase);
  if (!member) return { error: "No family found" };

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, title, is_global, family_id, calories_per_serving, protein_g, carbs_g, fat_g, nutrition_estimated")
    .eq("id", input.recipeId)
    .maybeSingle();
  if (!recipe) return { error: "Recipe not found" };
  if (!recipe.is_global && recipe.family_id !== member.family_id) return { error: "Recipe not found" };

  const servings = cleanServings(input.servings);
  const scale = (v: number | null) => (v == null ? null : Math.round(v * servings));

  const row = {
    family_member_id: member.id,
    logged_date: cleanDate(input.date),
    meal_type: cleanMealType(input.mealType),
    recipe_id: recipe.id,
    label: recipe.title,
    servings,
    calories: scale(recipe.calories_per_serving),
    protein_g: scale(recipe.protein_g),
    carbs_g: scale(recipe.carbs_g),
    fat_g: scale(recipe.fat_g),
    nutrition_estimated: recipe.nutrition_estimated,
  };

  const { data: saved, error } = await supabase
    .from("food_log_entries")
    .insert(row)
    .select("id, logged_date, meal_type, recipe_id, label, servings, calories, protein_g, carbs_g, fat_g, nutrition_estimated")
    .single();
  if (error || !saved) return { error: error?.message ?? "Failed to log meal" };

  revalidatePath("/food-log");
  return { entry: saved as LogEntry };
}

export async function addCustomLogEntry(input: {
  date: string;
  label: string;
  mealType?: string | null;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
}): Promise<{ error: string } | { entry: LogEntry }> {
  const supabase = await createClient();
  const member = await resolveMember(supabase);
  if (!member) return { error: "No family found" };

  const lf = filterText(input.label ?? "", 120);
  if (lf.error) return { error: lf.error };
  if (!lf.value) return { error: "Give the entry a name" };

  const nonNegInt = (v: number | null | undefined) => {
    if (v == null) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.min(Math.round(n), 100000);
  };

  const row = {
    family_member_id: member.id,
    logged_date: cleanDate(input.date),
    meal_type: cleanMealType(input.mealType),
    recipe_id: null,
    label: lf.value,
    servings: 1,
    calories: nonNegInt(input.calories),
    protein_g: nonNegInt(input.protein_g),
    carbs_g: nonNegInt(input.carbs_g),
    fat_g: nonNegInt(input.fat_g),
    nutrition_estimated: false,
  };

  const { data: saved, error } = await supabase
    .from("food_log_entries")
    .insert(row)
    .select("id, logged_date, meal_type, recipe_id, label, servings, calories, protein_g, carbs_g, fat_g, nutrition_estimated")
    .single();
  if (error || !saved) return { error: error?.message ?? "Failed to add entry" };

  revalidatePath("/food-log");
  return { entry: saved as LogEntry };
}

export async function deleteLogEntry(id: string): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const member = await resolveMember(supabase);
  if (!member) return { error: "No family found" };

  // RLS already restricts to the caller's entries; scope by member id as defence-in-depth.
  const { error } = await supabase
    .from("food_log_entries")
    .delete()
    .eq("id", id)
    .eq("family_member_id", member.id);
  if (error) return { error: error.message };

  revalidatePath("/food-log");
  return { ok: true };
}
