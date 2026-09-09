"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentWeekStart } from "../utils";
import { selectShoppingRecipes, scaleShoppingIngredients } from "@/lib/mealShopping";
import { consolidateIngredients } from "@/lib/ingredients";
export async function generateShoppingList(
  _prev: string | null,
  _formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .order("joined_at").order("id")
    .limit(1)
    .maybeSingle();
  if (!membership) return "No family found";

  const weekStart = currentWeekStart();

  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("family_id", membership.family_id)
    .eq("week_start_date", weekStart)
    .maybeSingle();
  if (!plan) return "No meal plan for this week";

  const { data: slots, error: slotError } = await supabase
    .from("meal_plan_slots")
    .select("id, day_of_week, course, option_number, recipe_id, status, committed_draft_id")
    .eq("meal_plan_id", plan.id);
  if (slotError) return slotError.message;

  try {
    const recipeOccurrences = selectShoppingRecipes(slots ?? []);
    if (!recipeOccurrences.length) return "No recipes in this week's plan";
    const uniqueIds = [...new Set(recipeOccurrences)];
    const [recipeResult, ingredientResult, memberResult] = await Promise.all([
      supabase.from("recipes").select("id, servings").in("id", uniqueIds),
      supabase.from("recipe_ingredients").select("recipe_id, name, quantity, unit").in("recipe_id", uniqueIds),
      supabase.from("family_members").select("id", { count: "exact", head: true }).eq("family_id", membership.family_id),
    ]);
    for (const result of [recipeResult, ingredientResult, memberResult]) {
      if (result.error) return result.error.message;
    }
    const items = consolidateIngredients(scaleShoppingIngredients(
      recipeOccurrences, recipeResult.data ?? [], ingredientResult.data ?? [], memberResult.count ?? 1,
    ));
    const { error } = await supabase.rpc("replace_shopping_list", { plan_id: plan.id, items });
    if (error) return error.message;
  } catch (error) {
    return error instanceof Error ? error.message : "Shopping generation failed";
  }

  redirect("/shopping-list");
}
