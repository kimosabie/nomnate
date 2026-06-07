import type { SpoonacularRecipe } from "@nomnate/types";

const BASE = "https://api.spoonacular.com";

function url(path: string, apiKey: string, params?: Record<string, string>) {
  const u = new URL(`${BASE}${path}`);
  u.searchParams.set("apiKey", apiKey);
  if (params) {
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  }
  return u.toString();
}

export async function searchRecipes(
  query: string,
  apiKey: string,
  options: { number?: number; diet?: string; cuisine?: string } = {}
): Promise<SpoonacularRecipe[]> {
  const params: Record<string, string> = {
    query,
    number: String(options.number ?? 10),
    addRecipeInformation: "true",
    addRecipeNutrition: "true",
    fillIngredients: "true",
  };
  if (options.diet) params.diet = options.diet;
  if (options.cuisine) params.cuisine = options.cuisine;

  const res = await fetch(url("/recipes/complexSearch", apiKey, params));
  if (!res.ok) throw new Error(`Spoonacular error: ${res.status}`);
  const data = await res.json();
  return data.results as SpoonacularRecipe[];
}

export async function getRecipeById(
  id: number,
  apiKey: string
): Promise<SpoonacularRecipe> {
  const res = await fetch(
    url(`/recipes/${id}/information`, apiKey, {
      includeNutrition: "true",
    })
  );
  if (!res.ok) throw new Error(`Spoonacular error: ${res.status}`);
  return res.json() as Promise<SpoonacularRecipe>;
}

export type NutritionEstimate = {
  calories_per_serving: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

// Estimate per-serving nutrition from a recipe title via Spoonacular's
// guessNutrition endpoint. Returns null when it can't produce a calorie figure.
export async function guessNutrition(
  title: string,
  apiKey: string
): Promise<NutritionEstimate | null> {
  const res = await fetch(url("/recipes/guessNutrition", apiKey, { title }));
  if (!res.ok) return null;
  const data = await res.json();
  const num = (v: unknown): number | null =>
    v && typeof (v as { value?: number }).value === "number"
      ? Math.round((v as { value: number }).value)
      : null;
  const calories = num(data.calories);
  if (calories == null) return null;
  return {
    calories_per_serving: calories,
    protein_g: num(data.protein),
    carbs_g: num(data.carbs),
    fat_g: num(data.fat),
  };
}

export async function getRandomRecipes(
  apiKey: string,
  options: { number?: number; tags?: string } = {}
): Promise<SpoonacularRecipe[]> {
  const params: Record<string, string> = {
    number: String(options.number ?? 7),
  };
  if (options.tags) params.tags = options.tags;

  const res = await fetch(url("/recipes/random", apiKey, params));
  if (!res.ok) throw new Error(`Spoonacular error: ${res.status}`);
  const data = await res.json();
  return data.recipes as SpoonacularRecipe[];
}
