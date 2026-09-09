import { assertMutableMeal } from "@nomnate/shared";
import { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Run before AI/rate-limit/image calls. RLS and the mutation guard repeat enforcement. */
export async function getMutableSlot(supabase: Client, slotId: string, familyId: string) {
  const { data: slot, error } = await supabase.from("meal_plan_slots")
    .select("id, meal_plan_id, day_of_week, course, status, committed_draft_id, meal_plans(family_id)")
    .eq("id", slotId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!slot || slot.meal_plans?.family_id !== familyId) throw new Error("Slot not found in your active family");
  assertMutableMeal(slot);
  return slot;
}

/** RETURNING distinguishes a successful write from a race/RLS-filtered zero-row write. */
export async function updateMutableSlot(supabase: Client, slotId: string, recipeId: string | null, emptyOnly = false) {
  let query = supabase.from("meal_plan_slots").update({ recipe_id: recipeId })
    .eq("id", slotId).neq("status", "confirmed").is("committed_draft_id", null);
  if (emptyOnly) query = query.is("recipe_id", null);
  const { data, error } = await query.select("id").maybeSingle();
  if (error) return error.message;
  if (!data) return "Meal changed, was committed, or is no longer accessible. Refresh and try again.";
  return null;
}

export function actionError(error: unknown): string {
  return error instanceof Error ? error.message : "Meal plan operation failed";
}
