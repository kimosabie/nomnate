"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { searchRecipes } from "@nomnate/lib/spoonacular";
import { mapSpoonacularDiets, getNutrient } from "@nomnate/types";
import type { SpoonacularRecipe } from "@nomnate/types";

// Spoonacular diet key → their API diet param
const DIET_FILTER_MAP: Record<string, string> = {
  vegetarian: "vegetarian",
  vegan: "vegan",
  "gluten-free": "gluten free",
  keto: "ketogenic",
  paleo: "paleo",
  whole30: "whole30",
  mediterranean: "mediterranean",
  "low-carb": "low calorie",
  "dairy-free": "lacto vegetarian", // closest available
};

export type SearchState = {
  results: SpoonacularRecipe[];
  error: string | null;
  dietFilter: string;
};

export async function searchSpoonacular(
  _prev: SearchState,
  formData: FormData
): Promise<SearchState> {
  const query = String(formData.get("query") ?? "").trim();
  const dietFilter = String(formData.get("diet_filter") ?? "");
  if (!query) return { results: [], error: null, dietFilter };

  try {
    const spoonacularDiet = DIET_FILTER_MAP[dietFilter] ?? undefined;
    const results = await searchRecipes(
      query,
      process.env.SPOONACULAR_API_KEY!,
      { number: 12, diet: spoonacularDiet }
    );
    return { results, error: null, dietFilter };
  } catch {
    return { results: [], error: "Search failed — try again", dietFilter };
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

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return "No family found";

  const familyId = membership.family_id;

  const { data: existing } = await supabase
    .from("recipes")
    .select("id")
    .eq("family_id", familyId)
    .eq("spoonacular_id", recipe.id)
    .maybeSingle();

  if (existing) return null;

  const dietTypes = mapSpoonacularDiets(recipe.diets ?? []);
  const nutrients = recipe.nutrition?.nutrients ?? [];
  const calories = getNutrient(nutrients, "Calories");
  const protein = getNutrient(nutrients, "Protein");
  const carbs = getNutrient(nutrients, "Carbohydrates");
  const fat = getNutrient(nutrients, "Fat");

  const { data: saved, error } = await supabase
    .from("recipes")
    .insert({
      family_id: familyId,
      title: recipe.title,
      source: "spoonacular" as const,
      instructions: recipe.instructions ?? null,
      image_url: recipe.image ?? null,
      prep_time: recipe.readyInMinutes ?? null,
      servings: recipe.servings ?? null,
      cuisine: recipe.cuisines?.[0] ?? null,
      diet_types: dietTypes,
      calories_per_serving: calories,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
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
    if (ingError) console.error("Failed to save ingredients:", ingError.message);
  }

  revalidatePath("/recipes");
  return null;
}

export async function deleteRecipe(recipeId: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";

  const { error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", recipeId)
    .eq("created_by", user.id);

  if (error) return error.message;

  revalidatePath("/recipes");
  revalidatePath("/meal-plan");
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

  await supabase
    .from("recipes")
    .update({ is_favourite: !isFavourite })
    .eq("id", recipeId)
    .eq("created_by", user.id);

  revalidatePath("/recipes");
}
