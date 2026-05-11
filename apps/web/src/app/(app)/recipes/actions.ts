"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { searchRecipes } from "@nomnate/lib/spoonacular";
import { searchMealDB, getSAMeals, lookupMealDB, extractIngredients } from "@nomnate/lib/themealdb";
import type { MealDBMeal, MealDBListItem } from "@nomnate/lib/themealdb";
import { checkRateLimit } from "@/lib/rateLimit";
import { mapSpoonacularDiets, getNutrient } from "@nomnate/types";
import type { SpoonacularRecipe } from "@nomnate/types";

// ─── Shared types ─────────────────────────────────────────────────────────────

export type RecipeCard = {
  id: string;
  title: string;
  image_url: string | null;
  prep_time: number | null;
  cuisine: string | null;
  source: string;
  source_attribution: string | null;
  is_global: boolean;
  inLibrary: boolean;
  is_favourite: boolean;
  diet_types: string[];
  calories_per_serving: number | null;
  external_id: string | null;
};

export type SearchState = {
  results: RecipeCard[];
  spoonResults: SpoonacularRecipe[];
  error: string | null;
  query: string;
  filter: string | null;
};

export type MealDBState = {
  results: MealDBMeal[];
  saItems: MealDBListItem[];
  error: string | null;
  mode: "idle" | "search" | "sa";
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getFamilyLibraryIds(familyId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("family_recipes")
    .select("recipe_id")
    .eq("family_id", familyId);
  return new Set((data ?? []).map((r) => r.recipe_id));
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

// ─── Unified DB-first search ─────────────────────────────────────────────────

const DB_THRESHOLD = 6; // If DB has this many results, skip external API call

export async function searchRecipesAction(
  _prev: SearchState,
  formData: FormData
): Promise<SearchState> {
  const query = String(formData.get("query") ?? "").trim();
  const filter = (formData.get("filter") as string | null) || null;

  if (!query && !filter) {
    return { results: [], spoonResults: [], error: null, query: "", filter: null };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { results: [], spoonResults: [], error: "Sign in to search recipes", query, filter };

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return { results: [], spoonResults: [], error: "No family found", query, filter };

  const familyId = membership.family_id;

  // Step 1: Build DB query
  let dbQuery = supabase
    .from("recipes")
    .select("id, title, image_url, prep_time, cuisine, source, source_attribution, is_global, diet_types, calories_per_serving, external_id")
    .limit(20);

  if (filter === "sa_classics") {
    dbQuery = dbQuery.ilike("cuisine", "%south african%");
  } else if (filter === "braai") {
    dbQuery = dbQuery.or("title.ilike.%braai%,cuisine.ilike.%south african%");
  } else if (filter === "healthy") {
    dbQuery = dbQuery.or(
      "diet_types.cs.{vegetarian},diet_types.cs.{vegan},diet_types.cs.{mediterranean},diet_types.cs.{gluten-free}"
    );
  } else if (filter === "quick") {
    dbQuery = dbQuery.or("prep_time.lt.30,prep_time.is.null").not("prep_time", "gt", 29);
  } else if (query) {
    dbQuery = dbQuery.ilike("title", `%${query}%`);
  }

  const { data: globalMatches } = await dbQuery.eq("is_global", true);

  // Manual family recipes matching the query
  let manualQuery = supabase
    .from("recipes")
    .select("id, title, image_url, prep_time, cuisine, source, source_attribution, is_global, diet_types, calories_per_serving, external_id")
    .eq("family_id", familyId)
    .eq("is_global", false)
    .limit(10);

  if (filter === "quick") {
    manualQuery = manualQuery.not("prep_time", "gt", 29);
  } else if (query) {
    manualQuery = manualQuery.ilike("title", `%${query}%`);
  }

  const [{ data: manualMatches }, libraryIds] = await Promise.all([
    manualQuery,
    getFamilyLibraryIds(familyId),
  ]);

  const dbResults: RecipeCard[] = [
    ...(globalMatches ?? []).map((r) => ({
      ...r,
      is_favourite: false,
      inLibrary: libraryIds.has(r.id),
      diet_types: (r.diet_types as string[]) ?? [],
      source_attribution: r.source_attribution ?? null,
      external_id: r.external_id ?? null,
    })),
    ...(manualMatches ?? []).map((r) => ({
      ...r,
      is_favourite: false,
      inLibrary: true,
      diet_types: (r.diet_types as string[]) ?? [],
      source_attribution: r.source_attribution ?? null,
      external_id: r.external_id ?? null,
    })),
  ];

  // Step 2: If query-based search and DB doesn't have enough, call Spoonacular
  let spoonResults: SpoonacularRecipe[] = [];
  if (query && dbResults.length < DB_THRESHOLD) {
    const rateOk = await checkRateLimit(supabase, user.id, "recipe_search", 20, 60);
    if (rateOk) {
      try {
        spoonResults = await searchRecipes(query, process.env.SPOONACULAR_API_KEY!, { number: 12 });
        // Save new Spoonacular results globally (fire-and-forget, errors don't block UI)
        void saveSpoonacularGlobally(spoonResults, user.id).catch(console.error);
      } catch {
        // Non-fatal — DB results are still useful
      }
    }
  }

  return { results: dbResults, spoonResults, error: null, query, filter };
}

// Upsert a batch of Spoonacular results to the global library (background)
async function saveSpoonacularGlobally(
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
        source: "spoonacular" as const,
        external_id: externalId,
        source_url: `https://spoonacular.com/recipes/${recipe.title.toLowerCase().replace(/\s+/g, "-")}-${recipe.id}`,
        source_attribution: "Recipe data provided by Spoonacular",
        image_url: recipe.image ?? null,
        prep_time: recipe.readyInMinutes ?? null,
        servings: recipe.servings ?? null,
        cuisine: recipe.cuisines?.[0] ?? null,
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

// ─── Add to family library ────────────────────────────────────────────────────

// Add a recipe (already in global DB) to the family's library
export async function addRecipeToLibrary(recipeId: string): Promise<string | null> {
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

  const { error } = await supabase.from("family_recipes").upsert(
    { family_id: membership.family_id, recipe_id: recipeId, added_by: user.id },
    { onConflict: "family_id,recipe_id", ignoreDuplicates: true }
  );

  if (error) return error.message;
  revalidatePath("/recipes");
  return null;
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

  // Check if already in global DB
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
        source: "spoonacular" as const,
        external_id: externalId,
        source_url: `https://spoonacular.com/recipes/${recipe.title.toLowerCase().replace(/\s+/g, "-")}-${recipe.id}`,
        source_attribution: "Recipe data provided by Spoonacular",
        image_url: recipe.image ?? null,
        prep_time: recipe.readyInMinutes ?? null,
        servings: recipe.servings ?? null,
        cuisine: recipe.cuisines?.[0] ?? null,
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

// Save a TheMealDB recipe globally + add to family library
export async function saveMealDBRecipe(
  mealId: string,
  partialTitle?: string
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

  const externalId = `themealdb_${mealId}`;

  let recipeId: string;
  const { data: existing } = await supabase
    .from("recipes")
    .select("id")
    .eq("external_id", externalId)
    .maybeSingle();

  if (existing) {
    recipeId = existing.id;
  } else {
    let meal: MealDBMeal | null = null;
    try {
      meal = await lookupMealDB(mealId);
    } catch {
      return "Could not fetch recipe details";
    }
    if (!meal) return "Recipe not found";

    const { data: saved, error } = await supabase
      .from("recipes")
      .insert({
        title: meal.strMeal ?? partialTitle ?? "Untitled",
        source: "themealdb" as const,
        external_id: externalId,
        source_url: `https://www.themealdb.com/meal/${mealId}`,
        source_attribution: "Recipe from TheMealDB (themealdb.com) — Community contributed",
        image_url: meal.strMealThumb ?? null,
        cuisine: meal.strCategory ?? meal.strArea ?? null,
        instructions: meal.strInstructions ?? null,
        is_global: true,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !saved) return error?.message ?? "Failed to save recipe";
    recipeId = saved.id;

    const ingredients = extractIngredients(meal);
    if (ingredients.length > 0) {
      await supabase.from("recipe_ingredients").insert(
        ingredients.map((ing) => ({
          recipe_id: recipeId,
          name: ing.name,
          quantity: null,
          unit: ing.measure || null,
        }))
      );
    }
  }

  await addToFamilyLibrary(supabase, membership.family_id, recipeId, user.id);
  revalidatePath("/recipes");
  return null;
}

// ─── TheMealDB search (still used for TheMealDB-specific browsing) ─────────

export async function searchMealDBRecipes(
  _prev: MealDBState,
  formData: FormData
): Promise<MealDBState> {
  const query = String(formData.get("query") ?? "").trim();
  if (!query) return { results: [], saItems: [], error: null, mode: "idle" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { results: [], saItems: [], error: "Sign in to search recipes", mode: "idle" };

  const allowed = await checkRateLimit(supabase, user.id, "recipe_search", 20, 60);
  if (!allowed) return { results: [], saItems: [], error: "Too many searches — try again in an hour", mode: "idle" };

  try {
    const results = await searchMealDB(query);
    return { results, saItems: [], error: null, mode: "search" };
  } catch {
    return { results: [], saItems: [], error: "Search failed — try again", mode: "idle" };
  }
}

export async function browseSouthAfricanMeals(): Promise<MealDBState> {
  try {
    const saItems = await getSAMeals();
    return { results: [], saItems, error: null, mode: "sa" };
  } catch {
    return { results: [], saItems: [], error: "Could not load South African meals", mode: "idle" };
  }
}

// ─── SA Staples seed ──────────────────────────────────────────────────────────

const SA_STAPLES = [
  {
    title: "Bobotie",
    description: "A Cape Malay baked mince dish with egg custard topping, fragrant with curry, apricot jam, and almonds.",
    instructions: "Sauté onion and garlic. Add minced beef and brown. Stir in curry powder, turmeric, vinegar, apricot jam, soaked bread, raisins, and almonds. Season well. Transfer to a baking dish. Beat eggs with milk and pour over the top with bay leaves. Bake at 180°C for 30-40 minutes until set and golden.",
    prep_time: 20, cook_time: 40, servings: 6,
    ingredients: [
      { name: "beef mince", quantity: 800, unit: "g" },
      { name: "onion", quantity: 2, unit: null },
      { name: "garlic cloves", quantity: 3, unit: null },
      { name: "curry powder", quantity: 2, unit: "tbsp" },
      { name: "turmeric", quantity: 1, unit: "tsp" },
      { name: "apricot jam", quantity: 2, unit: "tbsp" },
      { name: "white bread slices", quantity: 2, unit: null },
      { name: "milk", quantity: 250, unit: "ml" },
      { name: "eggs", quantity: 3, unit: null },
      { name: "raisins", quantity: 50, unit: "g" },
      { name: "almonds", quantity: 30, unit: "g" },
      { name: "bay leaves", quantity: 3, unit: null },
    ],
  },
  {
    title: "Braai Boerewors",
    description: "South Africa's iconic spiral sausage, coarsely spiced with coriander and cloves, best cooked over an open fire.",
    instructions: "Bring boerewors to room temperature. Coil on the braai grid over medium-hot coals. Cook for 8-10 minutes per side without piercing the casing. Rest for 5 minutes before serving with pap and chakalaka.",
    prep_time: 5, cook_time: 20, servings: 4,
    ingredients: [{ name: "boerewors", quantity: 1, unit: "kg" }],
  },
  {
    title: "Pap en Vleis",
    description: "The ultimate South African comfort food — stiff maize porridge served alongside slow-cooked beef or a spicy tomato-onion sauce.",
    instructions: "For stiff pap: bring salted water to a boil. Gradually stir in maize meal until thick. Cover and cook on lowest heat for 30-40 minutes, stirring occasionally. For vleis: brown onion, add tomatoes, sugar, and stock. Simmer diced beef until tender. Season and serve alongside.",
    prep_time: 10, cook_time: 45, servings: 4,
    ingredients: [
      { name: "maize meal", quantity: 500, unit: "g" },
      { name: "water", quantity: 1, unit: "l" },
      { name: "salt", quantity: 1, unit: "tsp" },
      { name: "beef chuck", quantity: 600, unit: "g" },
      { name: "onion", quantity: 2, unit: null },
      { name: "tomatoes", quantity: 4, unit: null },
      { name: "beef stock", quantity: 250, unit: "ml" },
    ],
  },
  {
    title: "Malva Pudding",
    description: "A sticky, sweet sponge pudding of Cape Malay origin, soaked in warm cream sauce — South Africa's most beloved dessert.",
    instructions: "Preheat oven to 180°C. Cream sugar and eggs. Add apricot jam, butter, and vinegar. Fold in flour and bicarbonate of soda alternating with milk. Pour into greased baking dish. Bake 30-35 minutes. Meanwhile heat cream, butter, and sugar for the sauce. Pour sauce over hot pudding immediately. Serve warm.",
    prep_time: 15, cook_time: 35, servings: 8,
    ingredients: [
      { name: "sugar", quantity: 200, unit: "g" },
      { name: "eggs", quantity: 2, unit: null },
      { name: "apricot jam", quantity: 2, unit: "tbsp" },
      { name: "butter", quantity: 30, unit: "g" },
      { name: "white vinegar", quantity: 1, unit: "tbsp" },
      { name: "flour", quantity: 250, unit: "g" },
      { name: "bicarbonate of soda", quantity: 1, unit: "tsp" },
      { name: "milk", quantity: 250, unit: "ml" },
      { name: "cream", quantity: 250, unit: "ml" },
    ],
  },
  {
    title: "Potjiekos",
    description: "A slow-cooked pot stew made in a cast-iron potjie over coals, layered with meat and vegetables — never stirred.",
    instructions: "Brown lamb shoulder pieces in the pot with oil. Add onion, garlic, and spices. Layer potatoes, carrots, sweet potato, and cabbage on top. Add red wine and stock. Cover tightly and simmer over low coals for 2-3 hours without stirring. Season and serve from the pot.",
    prep_time: 20, cook_time: 150, servings: 6,
    ingredients: [
      { name: "lamb shoulder", quantity: 1.5, unit: "kg" },
      { name: "onion", quantity: 2, unit: null },
      { name: "garlic cloves", quantity: 4, unit: null },
      { name: "potatoes", quantity: 4, unit: null },
      { name: "carrots", quantity: 3, unit: null },
      { name: "sweet potato", quantity: 1, unit: null },
      { name: "red wine", quantity: 250, unit: "ml" },
      { name: "beef stock", quantity: 250, unit: "ml" },
    ],
  },
  {
    title: "Vetkoek",
    description: "Deep-fried dough balls, crisp on the outside and fluffy inside — split open and filled with mince curry or golden syrup.",
    instructions: "Mix flour, yeast, salt, and sugar. Add warm water and knead until smooth. Rest 1 hour until doubled. Shape into balls. Deep fry at 180°C in batches for 4-5 minutes, turning once, until golden brown. Drain on paper towel. Serve filled with curried mince or syrup.",
    prep_time: 70, cook_time: 20, servings: 8,
    ingredients: [
      { name: "flour", quantity: 500, unit: "g" },
      { name: "instant yeast", quantity: 10, unit: "g" },
      { name: "salt", quantity: 1, unit: "tsp" },
      { name: "sugar", quantity: 1, unit: "tbsp" },
      { name: "warm water", quantity: 300, unit: "ml" },
      { name: "oil for frying", quantity: 1, unit: "l" },
    ],
  },
  {
    title: "Bunny Chow",
    description: "A Durban street food icon — a hollowed-out half loaf of white bread filled with rich curry, originating from the Indian community.",
    instructions: "Cook onion, ginger, and garlic until soft. Add curry leaves, cardamom, and curry powder. Brown chicken pieces. Add tinned tomatoes and water. Simmer 35-40 minutes until tender. While curry cooks, cut loaf in half lengthwise and hollow out the centre. Fill bread bowls with curry. Top with the bread you removed.",
    prep_time: 15, cook_time: 45, servings: 4,
    ingredients: [
      { name: "chicken pieces", quantity: 1, unit: "kg" },
      { name: "onion", quantity: 2, unit: null },
      { name: "ginger", quantity: 30, unit: "g" },
      { name: "garlic cloves", quantity: 4, unit: null },
      { name: "curry powder", quantity: 3, unit: "tbsp" },
      { name: "tinned tomatoes", quantity: 400, unit: "g" },
      { name: "curry leaves", quantity: 10, unit: null },
      { name: "white bread loaf", quantity: 2, unit: null },
    ],
  },
  {
    title: "Chakalaka",
    description: "A spicy, tangy relish of baked beans, peppers, carrots, and chilli — a South African braai essential.",
    instructions: "Sauté onion, garlic, and chilli. Add carrots, peppers, and curry powder. Cook 5 minutes. Add tinned tomatoes and baked beans. Simmer 10-15 minutes until thick. Season with salt. Serve warm or at room temperature as a relish.",
    prep_time: 10, cook_time: 20, servings: 6,
    ingredients: [
      { name: "onion", quantity: 2, unit: null },
      { name: "garlic cloves", quantity: 3, unit: null },
      { name: "carrots", quantity: 3, unit: null },
      { name: "green pepper", quantity: 2, unit: null },
      { name: "chilli", quantity: 2, unit: null },
      { name: "curry powder", quantity: 2, unit: "tbsp" },
      { name: "tinned tomatoes", quantity: 400, unit: "g" },
      { name: "baked beans in tomato sauce", quantity: 410, unit: "g" },
    ],
  },
  {
    title: "Sosaties",
    description: "Skewered marinated meat — a Cape Malay contribution to the braai, tangy and spiced with apricot, curry, and tamarind.",
    instructions: "Mix curry powder, turmeric, apricot jam, vinegar, and oil for the marinade. Cube lamb and marinate overnight. Thread onto skewers with dried apricots and onion wedges. Braai over medium coals for 12-15 minutes, turning regularly. Serve with pap or bread.",
    prep_time: 20, cook_time: 15, servings: 4,
    ingredients: [
      { name: "lamb leg", quantity: 800, unit: "g" },
      { name: "curry powder", quantity: 2, unit: "tbsp" },
      { name: "turmeric", quantity: 1, unit: "tsp" },
      { name: "apricot jam", quantity: 3, unit: "tbsp" },
      { name: "white vinegar", quantity: 60, unit: "ml" },
      { name: "oil", quantity: 60, unit: "ml" },
      { name: "dried apricots", quantity: 100, unit: "g" },
      { name: "onion", quantity: 2, unit: null },
    ],
  },
  {
    title: "Melktert",
    description: "A traditional Afrikaner milk tart with a sweet pastry crust and silky cinnamon-dusted custard filling.",
    instructions: "Make pastry by rubbing butter into flour with icing sugar. Bind with egg. Press into tart tin and blind bake at 180°C for 15 minutes. Heat milk with butter and sugar. Whisk cornflour and eggs with cold milk, then stir into hot milk. Cook on medium heat, stirring constantly until thick. Pour into pastry shell. Dust with cinnamon. Refrigerate until set.",
    prep_time: 30, cook_time: 20, servings: 8,
    ingredients: [
      { name: "flour", quantity: 200, unit: "g" },
      { name: "butter", quantity: 100, unit: "g" },
      { name: "icing sugar", quantity: 30, unit: "g" },
      { name: "egg", quantity: 1, unit: null },
      { name: "milk", quantity: 750, unit: "ml" },
      { name: "sugar", quantity: 120, unit: "g" },
      { name: "cornflour", quantity: 50, unit: "g" },
      { name: "eggs", quantity: 3, unit: null },
      { name: "cinnamon", quantity: 2, unit: "tsp" },
    ],
  },
];

export async function seedSARecipes(): Promise<{ seeded: number; skipped: number; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { seeded: 0, skipped: 0, error: "Not authenticated" };

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return { seeded: 0, skipped: 0, error: "No family found" };

  let seeded = 0, skipped = 0;

  for (const staple of SA_STAPLES) {
    const { data: existing } = await supabase
      .from("recipes")
      .select("id")
      .ilike("title", staple.title)
      .eq("is_global", true)
      .maybeSingle();

    let recipeId: string;

    if (existing) {
      recipeId = existing.id;
      skipped++;
    } else {
      const { data: saved, error } = await supabase
        .from("recipes")
        .insert({
          title: staple.title,
          description: staple.description,
          source: "ai" as const,
          source_attribution: "AI-generated recipe by Claude (Anthropic). Inspired by traditional South African cuisine.",
          cuisine: "South African",
          instructions: staple.instructions,
          prep_time: staple.prep_time,
          cook_time: staple.cook_time,
          servings: staple.servings,
          is_global: true,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (error || !saved) { console.error(`Seed error for ${staple.title}:`, error?.message); continue; }
      recipeId = saved.id;

      if (staple.ingredients.length > 0) {
        await supabase.from("recipe_ingredients").insert(
          staple.ingredients.map((ing) => ({
            recipe_id: recipeId,
            name: ing.name,
            quantity: ing.quantity ?? null,
            unit: ing.unit ?? null,
          }))
        );
      }
      seeded++;
    }

    // Always add to family library
    await addToFamilyLibrary(supabase, membership.family_id, recipeId, user.id);
  }

  revalidatePath("/recipes");
  return { seeded, skipped, error: null };
}

// ─── Library management ───────────────────────────────────────────────────────

export async function deleteRecipe(recipeId: string): Promise<string | null> {
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

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, is_global")
    .eq("id", recipeId)
    .maybeSingle();
  if (!recipe) return "Recipe not found";

  if (recipe.is_global) {
    // Remove from family library only; preserve global recipe
    const { error } = await supabase
      .from("family_recipes")
      .delete()
      .eq("recipe_id", recipeId)
      .eq("family_id", membership.family_id);
    if (error) return error.message;
  } else {
    // Delete the manual recipe row entirely
    const { error } = await supabase
      .from("recipes")
      .delete()
      .eq("id", recipeId)
      .eq("created_by", user.id);
    if (error) return error.message;
  }

  revalidatePath("/recipes");
  revalidatePath("/meal-plan");
  return null;
}

export async function resetRecipeLibrary(): Promise<string | null> {
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

  // Remove all global recipes from library + delete manual recipes created by this user
  await Promise.all([
    supabase.from("family_recipes").delete().eq("family_id", membership.family_id),
    supabase.from("recipes").delete().eq("family_id", membership.family_id).eq("is_global", false).eq("created_by", user.id),
  ]);

  revalidatePath("/recipes");
  revalidatePath("/meal-plan");
  return null;
}

export async function toggleFavourite(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const recipeId = String(formData.get("recipeId") ?? "");
  const isFavourite = formData.get("isFavourite") === "true";

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return;

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, is_global")
    .eq("id", recipeId)
    .maybeSingle();
  if (!recipe) return;

  if (recipe.is_global) {
    await supabase
      .from("family_recipes")
      .update({ is_favourite: !isFavourite })
      .eq("recipe_id", recipeId)
      .eq("family_id", membership.family_id);
  } else {
    await supabase
      .from("recipes")
      .update({ is_favourite: !isFavourite })
      .eq("id", recipeId)
      .eq("created_by", user.id);
  }

  revalidatePath("/recipes");
}

// Keep legacy saveRecipe export so the old TheMealDB tab path still compiles
// (RecipeSearch.tsx now uses saveSpoonacularRecipe instead)
export { saveSpoonacularRecipe as saveRecipe };
