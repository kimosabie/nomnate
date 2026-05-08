"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { searchRecipes } from "@nomnate/lib/spoonacular";
import type { SpoonacularRecipe } from "@nomnate/types";

export type SearchState = {
  results: SpoonacularRecipe[];
  error: string | null;
};

export async function searchSpoonacular(
  _prev: SearchState,
  formData: FormData
): Promise<SearchState> {
  const query = String(formData.get("query") ?? "").trim();
  if (!query) return { results: [], error: null };

  try {
    const results = await searchRecipes(
      query,
      process.env.SPOONACULAR_API_KEY!,
      { number: 12 }
    );
    return { results, error: null };
  } catch {
    return { results: [], error: "Search failed — try again" };
  }
}

export async function saveRecipe(
  recipe: SpoonacularRecipe
): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";

  // Always derive familyId server-side — never trust the client
  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return "No family found";

  const familyId = membership.family_id;

  // Idempotent — if already saved for this family, treat as success
  const { data: existing } = await supabase
    .from("recipes")
    .select("id")
    .eq("family_id", familyId)
    .eq("spoonacular_id", recipe.id)
    .maybeSingle();

  if (existing) return null;

  const { data: saved, error } = await supabase
    .from("recipes")
    .insert({
      family_id: familyId,
      title: recipe.title,
      source: "spoonacular" as const,
      instructions: recipe.instructions ?? null,
      image_url: recipe.image ?? null,
      prep_time: recipe.readyInMinutes ?? null,
      cuisine: recipe.cuisines?.[0] ?? null,
      spoonacular_id: recipe.id,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return error.message;

  const ingredients = recipe.extendedIngredients ?? [];
  if (ingredients.length > 0) {
    const { error: ingError } = await supabase
      .from("recipe_ingredients")
      .insert(
        ingredients.map((ing) => ({
          recipe_id: saved.id,
          name: ing.name,
          quantity: ing.amount ?? null,
          unit: ing.unit || null,
        }))
      );
    // Ingredient failure is non-fatal — recipe is saved, just without breakdown
    if (ingError) console.error("Failed to save ingredients:", ingError.message);
  }

  revalidatePath("/recipes");
  return null;
}

export async function toggleFavourite(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const recipeId = String(formData.get("recipeId") ?? "");
  const isFavourite = formData.get("isFavourite") === "true";

  // RLS enforces created_by = auth.uid(); this is belt-and-suspenders
  await supabase
    .from("recipes")
    .update({ is_favourite: !isFavourite })
    .eq("id", recipeId)
    .eq("created_by", user.id);

  revalidatePath("/recipes");
}
