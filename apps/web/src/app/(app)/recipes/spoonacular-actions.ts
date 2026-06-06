"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapSpoonacularDiets, getNutrient, courseFromSpoonacularDishTypes, courseFromTitle } from "@nomnate/types";
import type { SpoonacularRecipe } from "@nomnate/types";

function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim() || null;
}

async function addToFamilyLibrary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  familyId: string,
  recipeId: string,
  userId: string
): Promise<void> {
  await supabase.from("family_recipes").upsert(
    { family_id: familyId, recipe_id: recipeId, added_by: userId },
    { onConflict: "family_id,recipe_id", ignoreDuplicates: true }
  );
}

// Upsert a batch of Spoonacular results to the global library (background)
export async function saveSpoonacularGlobally(
  recipes: SpoonacularRecipe[],
  userId: string
): Promise<void> {
  const supabase = await createClient();
  for (const recipe of recipes) {
    const externalId = `spoonacular_${recipe.id}`;
    const { data: existing } = await supabase
      .from("recipes")
      .select("id")
      .eq("external_id", externalId)
      .maybeSingle();
    if (existing) continue;

    const nutrients = recipe.nutrition?.nutrients ?? [];
    const { data: saved } = await supabase
      .from("recipes")
      .insert({
        title: recipe.title,
        description: stripHtml(recipe.summary),
        instructions: stripHtml(recipe.instructions),
        source: "spoonacular" as const,
        external_id: externalId,
        source_url: `https://spoonacular.com/recipes/${recipe.title.toLowerCase().replace(/\s+/g, "-")}-${recipe.id}`,
        source_attribution: "Recipe sourced online via NomNate",
        image_url: recipe.image ?? null,
        prep_time: recipe.readyInMinutes ?? null,
        servings: recipe.servings ?? null,
        cuisine: recipe.cuisines?.[0] ?? null,
        course: courseFromSpoonacularDishTypes(recipe.dishTypes ?? []) ?? courseFromTitle(recipe.title),
        diet_types: mapSpoonacularDiets(recipe.diets ?? []),
        calories_per_serving: getNutrient(nutrients, "Calories"),
        protein_g: getNutrient(nutrients, "Protein"),
        carbs_g: getNutrient(nutrients, "Carbohydrates"),
        fat_g: getNutrient(nutrients, "Fat"),
        is_global: true,
        created_by: userId,
      })
      .select("id")
      .single();

    if (saved && (recipe.extendedIngredients ?? []).length > 0) {
      await supabase.from("recipe_ingredients").insert(
        recipe.extendedIngredients.map((ing) => ({
          recipe_id: saved.id,
          name: ing.name,
          quantity: ing.amount ?? null,
          unit: ing.unit || null,
        }))
      );
    }
  }
}

// Save a Spoonacular recipe globally + add to family library
export async function saveSpoonacularRecipe(
  recipe: SpoonacularRecipe
): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return "No family found";

  const externalId = `spoonacular_${recipe.id}`;

  let recipeId: string;
  const { data: existing } = await supabase
    .from("recipes")
    .select("id")
    .eq("external_id", externalId)
    .maybeSingle();

  if (existing) {
    recipeId = existing.id;
  } else {
    const nutrients = recipe.nutrition?.nutrients ?? [];
    const { data: saved, error } = await supabase
      .from("recipes")
      .insert({
        title: recipe.title,
        description: stripHtml(recipe.summary),
        instructions: stripHtml(recipe.instructions),
        source: "spoonacular" as const,
        external_id: externalId,
        source_url: `https://spoonacular.com/recipes/${recipe.title.toLowerCase().replace(/\s+/g, "-")}-${recipe.id}`,
        source_attribution: "Recipe sourced online via NomNate",
        image_url: recipe.image ?? null,
        prep_time: recipe.readyInMinutes ?? null,
        servings: recipe.servings ?? null,
        cuisine: recipe.cuisines?.[0] ?? null,
        course: courseFromSpoonacularDishTypes(recipe.dishTypes ?? []) ?? courseFromTitle(recipe.title),
        diet_types: mapSpoonacularDiets(recipe.diets ?? []),
        calories_per_serving: getNutrient(nutrients, "Calories"),
        protein_g: getNutrient(nutrients, "Protein"),
        carbs_g: getNutrient(nutrients, "Carbohydrates"),
        fat_g: getNutrient(nutrients, "Fat"),
        is_global: true,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !saved) return error?.message ?? "Failed to save recipe";
    recipeId = saved.id;

    if ((recipe.extendedIngredients ?? []).length > 0) {
      await supabase.from("recipe_ingredients").insert(
        recipe.extendedIngredients.map((ing) => ({
          recipe_id: recipeId,
          name: ing.name,
          quantity: ing.amount ?? null,
          unit: ing.unit || null,
        }))
      );
    }
  }

  await addToFamilyLibrary(supabase, membership.family_id, recipeId, user.id);
  revalidatePath("/recipes");
  return null;
}
