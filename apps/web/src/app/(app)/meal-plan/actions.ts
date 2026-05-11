"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { suggestMeals } from "@nomnate/lib/claude";
import { searchRecipes } from "@nomnate/lib/spoonacular";
import type { SuggestedRecipe } from "@nomnate/types";
import { currentWeekStart } from "./utils";

const UNIT_ALIASES: Record<string, string> = {
  gram: "g", grams: "g",
  kilogram: "kg", kilograms: "kg",
  milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml",
  liter: "l", liters: "l", litre: "l", litres: "l",
  tablespoon: "tbsp", tablespoons: "tbsp",
  teaspoon: "tsp", teaspoons: "tsp",
  ounce: "oz", ounces: "oz",
  pound: "lb", pounds: "lb",
  cups: "cup",
  cloves: "clove",
  pieces: "piece",
  cans: "can",
  slices: "slice",
};

function normalizeUnit(unit: string | null | undefined): string {
  if (!unit) return "";
  const lower = unit.toLowerCase().trim();
  return UNIT_ALIASES[lower] ?? lower;
}

async function fetchImageByTitle(title: string): Promise<string | null> {
  try {
    const results = await searchRecipes(title, process.env.SPOONACULAR_API_KEY!, { number: 1 });
    return results[0]?.image ?? null;
  } catch {
    return null;
  }
}
import { FREE_AI_LIMIT } from "./constants";
import { checkRateLimit } from "@/lib/rateLimit";

export async function getAIUsageThisWeek(familyId: string): Promise<number> {
  const supabase = await createClient();
  const weekStart = currentWeekStart();
  const { count } = await supabase
    .from("recipes")
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId)
    .eq("source", "ai")
    .gte("created_at", weekStart + "T00:00:00.000Z");
  return count ?? 0;
}

export async function suggestWithAI(
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
    .limit(1)
    .maybeSingle();
  if (!membership) return "No family found";

  const weekStart = currentWeekStart();
  const usedThisWeek = await getAIUsageThisWeek(membership.family_id);
  const remaining = FREE_AI_LIMIT - usedThisWeek;

  if (remaining <= 0) {
    return "You've used all 5 AI suggestions for this week. Upgrade to Premium for unlimited.";
  }

  // Burst limit: 2 AI suggestion calls per hour prevents rapid-fire abuse
  const burstOk = await checkRateLimit(supabase, user.id, "ai_suggest", 2, 60);
  if (!burstOk) {
    return "Too many requests — wait a moment before generating more suggestions.";
  }

  // Gather family context — preferences only, never PII
  const { data: members } = await supabase
    .from("family_members")
    .select("dietary_restrictions, cuisine_preferences, ingredient_dislikes, liked_ingredients, diet_types, daily_calorie_target")
    .eq("family_id", membership.family_id);

  const allRestrictions = [
    ...new Set(
      (members ?? []).flatMap((m) => (m.dietary_restrictions as string[]) ?? [])
    ),
  ];
  const allCuisinePrefs = [
    ...new Set(
      (members ?? []).flatMap((m) => (m.cuisine_preferences as string[]) ?? [])
    ),
  ];
  const allDislikes = [
    ...new Set(
      (members ?? []).flatMap((m) => (m.ingredient_dislikes as string[]) ?? [])
    ),
  ];
  const allLiked = [
    ...new Set(
      (members ?? []).flatMap((m) => (m.liked_ingredients as string[]) ?? [])
    ),
  ];
  const allDietTypes = [
    ...new Set(
      (members ?? []).flatMap((m) => (m.diet_types as string[]) ?? [])
    ),
  ];
  const calorieTarget =
    (members ?? []).find((m) => m.daily_calorie_target != null)
      ?.daily_calorie_target ?? null;
  const familySize = members?.length ?? 1;

  const { data: existingRecipes } = await supabase
    .from("recipes")
    .select("title")
    .eq("family_id", membership.family_id);

  const excludeTitles = (existingRecipes ?? []).map((r) => r.title);
  const count = Math.min(remaining, 7);

  let suggestions: SuggestedRecipe[];
  try {
    suggestions = await suggestMeals({
      familySize,
      dietaryRestrictions: allRestrictions,
      cuisinePreferences: allCuisinePrefs,
      ingredientDislikes: allDislikes,
      likedIngredients: allLiked,
      dietTypes: allDietTypes,
      calorieTarget,
      excludeTitles,
      count,
    });
  } catch (err) {
    return err instanceof Error ? err.message : "AI suggestion failed — try again";
  }

  // Fetch food photos in parallel before saving
  const imageUrls = await Promise.all(suggestions.map((s) => fetchImageByTitle(s.title)));

  // Save generated recipes to the family library
  const savedIds: string[] = [];
  for (let i = 0; i < suggestions.length; i++) {
    const s = suggestions[i];
    const { data: saved, error } = await supabase
      .from("recipes")
      .insert({
        family_id: membership.family_id,
        title: s.title,
        source: "ai" as const,
        instructions: s.instructions,
        prep_time: s.prep_time,
        cuisine: s.cuisine,
        image_url: imageUrls[i] ?? null,
        calories_per_serving: s.calories_per_serving ?? null,
        protein_g: s.protein_g ?? null,
        carbs_g: s.carbs_g ?? null,
        fat_g: s.fat_g ?? null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !saved) continue;

    if (s.ingredients.length > 0) {
      await supabase.from("recipe_ingredients").insert(
        s.ingredients.map((ing) => ({
          recipe_id: saved.id,
          name: ing.name,
          quantity: ing.quantity ?? null,
          unit: ing.unit || null,
        }))
      );
    }
    savedIds.push(saved.id);
  }

  if (savedIds.length === 0) return "Failed to save AI recipes — try again";

  // Create or update the meal plan
  const { data: existingPlan } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("family_id", membership.family_id)
    .eq("week_start_date", weekStart)
    .maybeSingle();

  if (existingPlan) {
    // Fill empty option slots in order
    const { data: emptySlots } = await supabase
      .from("meal_plan_slots")
      .select("id")
      .eq("meal_plan_id", existingPlan.id)
      .is("recipe_id", null)
      .order("day_of_week")
      .order("option_number");

    const targets = emptySlots ?? [];
    await Promise.all(
      targets.slice(0, savedIds.length).map((target, i) =>
        supabase
          .from("meal_plan_slots")
          .update({ recipe_id: savedIds[i] })
          .eq("id", target.id)
      )
    );
  } else {
    const { data: plan, error: planError } = await supabase
      .from("meal_plans")
      .insert({ family_id: membership.family_id, week_start_date: weekStart })
      .select("id")
      .single();
    if (planError) {
      if (planError.code === "23505") redirect("/meal-plan");
      return planError.message;
    }

    // Create 1 option per day for AI-generated plans (fills option 1 of each day)
    const slots = Array.from({ length: 7 }, (_, i) => ({
      meal_plan_id: plan.id,
      day_of_week: i,
      option_number: 1,
      recipe_id: savedIds[i] ?? null,
      status: "suggested" as const,
    }));
    const { error: slotsError } = await supabase
      .from("meal_plan_slots")
      .insert(slots);
    if (slotsError) return slotsError.message;
  }

  redirect("/meal-plan");
}

export async function generatePlan(
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
    .limit(1)
    .maybeSingle();
  if (!membership) return "No family found";

  const weekStart = currentWeekStart();

  // Idempotent — if a plan already exists this week, just navigate there
  const { data: existing } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("family_id", membership.family_id)
    .eq("week_start_date", weekStart)
    .maybeSingle();
  if (existing) redirect("/meal-plan");

  // Fetch family recipes — favourites first, then shuffle the rest
  const { data: recipes } = await supabase
    .from("recipes")
    .select("id, is_favourite")
    .eq("family_id", membership.family_id);

  const favIds = (recipes ?? [])
    .filter((r) => r.is_favourite)
    .map((r) => r.id);
  const otherIds = (recipes ?? [])
    .filter((r) => !r.is_favourite)
    .map((r) => r.id);

  // Fisher-Yates shuffle
  const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const shuffledFavs = shuffle(favIds);
  const shuffledOther = shuffle(otherIds);
  const allIds = [...shuffledFavs, ...shuffledOther];

  // Create the meal plan — handle race condition where another member beat us here
  const { data: plan, error: planError } = await supabase
    .from("meal_plans")
    .insert({ family_id: membership.family_id, week_start_date: weekStart })
    .select("id")
    .single();
  if (planError) {
    if (planError.code === "23505") redirect("/meal-plan");
    return planError.message;
  }

  // For each of 7 days, create 3 options — pick without replacement across the pool,
  // cycling back if the library is smaller than 21.
  const slots: {
    meal_plan_id: string;
    day_of_week: number;
    option_number: number;
    recipe_id: string | null;
    status: "suggested";
  }[] = [];

  if (allIds.length === 0) {
    // No recipes yet — create empty slots (1 option per day to keep it simple)
    for (let d = 0; d < 7; d++) {
      slots.push({ meal_plan_id: plan.id, day_of_week: d, option_number: 1, recipe_id: null, status: "suggested" });
    }
  } else {
    // Build a pool that's large enough for 21 picks (7 days × 3 options)
    const needed = 7 * 3;
    const pool: string[] = [];
    while (pool.length < needed) {
      pool.push(...shuffle([...allIds]));
    }
    let idx = 0;
    for (let d = 0; d < 7; d++) {
      for (let opt = 1; opt <= 3; opt++) {
        slots.push({
          meal_plan_id: plan.id,
          day_of_week: d,
          option_number: opt,
          recipe_id: pool[idx++],
          status: "suggested",
        });
      }
    }
  }

  const { error: slotsError } = await supabase
    .from("meal_plan_slots")
    .insert(slots);
  if (slotsError) return slotsError.message;

  redirect("/meal-plan");
}

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

  // For each day, use the confirmed option first, then the lowest option_number with a recipe
  const { data: allSlots } = await supabase
    .from("meal_plan_slots")
    .select("day_of_week, option_number, recipe_id, status")
    .eq("meal_plan_id", plan.id)
    .not("recipe_id", "is", null)
    .order("day_of_week")
    .order("option_number");

  // Pick one recipe per day (confirmed > option 1 > first available)
  const dayMap = new Map<number, string>();
  for (const s of allSlots ?? []) {
    const existing = dayMap.get(s.day_of_week);
    if (!existing || s.status === "confirmed") {
      dayMap.set(s.day_of_week, s.recipe_id as string);
    }
  }
  const recipeIds = [...new Set(dayMap.values())];
  if (recipeIds.length === 0) return "No recipes in this week's plan";

  const { data: allIngredients, error: ingError } = await supabase
    .from("recipe_ingredients")
    .select("name, quantity, unit")
    .in("recipe_id", recipeIds);

  if (ingError) return ingError.message;

  type Item = { ingredient_name: string; quantity: number | null; unit: string | null };
  const map = new Map<string, Item>();
  for (const ing of allIngredients ?? []) {
    const normUnit = normalizeUnit(ing.unit);
    const key = `${ing.name.toLowerCase().trim()}|${normUnit}`;
    const existing = map.get(key);
    if (existing) {
      if (existing.quantity != null && ing.quantity != null) {
        existing.quantity = existing.quantity + ing.quantity;
      } else if (existing.quantity == null) {
        existing.quantity = ing.quantity ?? null;
      }
    } else {
      map.set(key, {
        ingredient_name: ing.name,
        quantity: ing.quantity ?? null,
        unit: normUnit || null,
      });
    }
  }

  const items = [...map.values()].sort((a, b) =>
    a.ingredient_name.localeCompare(b.ingredient_name)
  );

  // Delete any existing list(s) so we start fresh
  await supabase.from("shopping_lists").delete().eq("meal_plan_id", plan.id);

  const { data: list, error: listError } = await supabase
    .from("shopping_lists")
    .insert({ meal_plan_id: plan.id })
    .select("id")
    .single();
  if (listError) return listError.message;

  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from("shopping_list_items")
      .insert(items.map((i) => ({ ...i, list_id: list.id })));
    if (itemsError) return itemsError.message;
  }

  redirect("/shopping-list");
}

export async function removeFromSlot(slotId: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";

  const { error } = await supabase
    .from("meal_plan_slots")
    .update({ recipe_id: null })
    .eq("id", slotId);

  if (error) return error.message;
  revalidatePath("/meal-plan");
  return null;
}

export async function assignRecipeToSlot(
  slotId: string,
  recipeId: string
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

  // Verify recipe belongs to this family before assigning
  const { data: recipe } = await supabase
    .from("recipes")
    .select("id")
    .eq("id", recipeId)
    .eq("family_id", membership.family_id)
    .maybeSingle();
  if (!recipe) return "Recipe not found";

  const { error } = await supabase
    .from("meal_plan_slots")
    .update({ recipe_id: recipeId })
    .eq("id", slotId);

  if (error) return error.message;
  revalidatePath("/meal-plan");
  return null;
}

type SlotRecipe = {
  id: string;
  title: string;
  image_url: string | null;
  prep_time: number | null;
  cuisine: string | null;
};

export async function suggestForSlot(
  slotId: string
): Promise<{ error: string } | { recipe: SlotRecipe }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return { error: "No family found" };

  const usedThisWeek = await getAIUsageThisWeek(membership.family_id);
  if (FREE_AI_LIMIT - usedThisWeek <= 0) {
    return { error: "You've used all 5 AI suggestions for this week" };
  }

  const burstOk = await checkRateLimit(supabase, user.id, "ai_suggest", 2, 60);
  if (!burstOk) {
    return { error: "Too many requests — wait a moment before trying again." };
  }

  const { data: members } = await supabase
    .from("family_members")
    .select("dietary_restrictions, cuisine_preferences, ingredient_dislikes, liked_ingredients, diet_types, daily_calorie_target")
    .eq("family_id", membership.family_id);

  const allRestrictions = [
    ...new Set(
      (members ?? []).flatMap((m) => (m.dietary_restrictions as string[]) ?? [])
    ),
  ];
  const allCuisinePrefs = [
    ...new Set(
      (members ?? []).flatMap((m) => (m.cuisine_preferences as string[]) ?? [])
    ),
  ];
  const allDislikes = [
    ...new Set(
      (members ?? []).flatMap((m) => (m.ingredient_dislikes as string[]) ?? [])
    ),
  ];
  const allLikedSlot = [
    ...new Set(
      (members ?? []).flatMap((m) => (m.liked_ingredients as string[]) ?? [])
    ),
  ];
  const allDietTypesSlot = [
    ...new Set(
      (members ?? []).flatMap((m) => (m.diet_types as string[]) ?? [])
    ),
  ];
  const calorieTargetSlot =
    (members ?? []).find((m) => m.daily_calorie_target != null)
      ?.daily_calorie_target ?? null;
  const familySize = members?.length ?? 1;

  const { data: existingRecipes } = await supabase
    .from("recipes")
    .select("title")
    .eq("family_id", membership.family_id);

  const excludeTitles = (existingRecipes ?? []).map((r) => r.title);

  let suggestions: SuggestedRecipe[];
  try {
    suggestions = await suggestMeals({
      familySize,
      dietaryRestrictions: allRestrictions,
      cuisinePreferences: allCuisinePrefs,
      ingredientDislikes: allDislikes,
      likedIngredients: allLikedSlot,
      dietTypes: allDietTypesSlot,
      calorieTarget: calorieTargetSlot,
      excludeTitles,
      count: 1,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI suggestion failed" };
  }

  if (!suggestions.length) return { error: "No suggestion returned" };
  const s = suggestions[0];

  const slotImageUrl = await fetchImageByTitle(s.title);

  const { data: saved, error: saveError } = await supabase
    .from("recipes")
    .insert({
      family_id: membership.family_id,
      title: s.title,
      source: "ai" as const,
      instructions: s.instructions,
      prep_time: s.prep_time,
      cuisine: s.cuisine,
      image_url: slotImageUrl,
      calories_per_serving: s.calories_per_serving ?? null,
      protein_g: s.protein_g ?? null,
      carbs_g: s.carbs_g ?? null,
      fat_g: s.fat_g ?? null,
      created_by: user.id,
    })
    .select("id, title, image_url, prep_time, cuisine")
    .single();

  if (saveError || !saved) return { error: saveError?.message ?? "Failed to save recipe" };

  if (s.ingredients.length > 0) {
    await supabase.from("recipe_ingredients").insert(
      s.ingredients.map((ing) => ({
        recipe_id: saved.id,
        name: ing.name,
        quantity: ing.quantity ?? null,
        unit: ing.unit || null,
      }))
    );
  }

  const { error: updateError } = await supabase
    .from("meal_plan_slots")
    .update({ recipe_id: saved.id })
    .eq("id", slotId);

  if (updateError) return { error: updateError.message };

  revalidatePath("/meal-plan");
  return {
    recipe: {
      id: saved.id,
      title: saved.title,
      image_url: saved.image_url ?? null,
      prep_time: saved.prep_time ?? null,
      cuisine: saved.cuisine ?? null,
    },
  };
}

export async function resetPlan(
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
    .limit(1)
    .maybeSingle();
  if (!membership) return "No family found";

  const weekStart = currentWeekStart();

  // Find or create the meal plan for this week
  let planId: string | null = null;

  const { data: existing } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("family_id", membership.family_id)
    .eq("week_start_date", weekStart)
    .maybeSingle();

  if (existing) {
    planId = existing.id;
    // Delete all slots (votes cascade via FK)
    await supabase.from("meal_plan_slots").delete().eq("meal_plan_id", planId);
    // Delete shopping lists
    await supabase.from("shopping_lists").delete().eq("meal_plan_id", planId);
  } else {
    const { data: newPlan, error: planError } = await supabase
      .from("meal_plans")
      .insert({ family_id: membership.family_id, week_start_date: weekStart })
      .select("id")
      .single();
    if (planError) return planError.message;
    planId = newPlan.id;
  }

  // Fetch family recipes for slot generation
  const { data: recipes } = await supabase
    .from("recipes")
    .select("id, is_favourite")
    .eq("family_id", membership.family_id);

  const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const favIds = (recipes ?? []).filter((r) => r.is_favourite).map((r) => r.id);
  const otherIds = (recipes ?? []).filter((r) => !r.is_favourite).map((r) => r.id);
  const allIds = [...shuffle(favIds), ...shuffle(otherIds)];

  type SlotInsert = {
    meal_plan_id: string;
    day_of_week: number;
    option_number: number;
    recipe_id: string | null;
    status: "suggested";
  };
  const slots: SlotInsert[] = [];

  if (allIds.length === 0) {
    for (let d = 0; d < 7; d++) {
      slots.push({ meal_plan_id: planId, day_of_week: d, option_number: 1, recipe_id: null, status: "suggested" });
    }
  } else {
    const needed = 7 * 3;
    const pool: string[] = [];
    while (pool.length < needed) pool.push(...shuffle([...allIds]));
    let idx = 0;
    for (let d = 0; d < 7; d++) {
      for (let opt = 1; opt <= 3; opt++) {
        slots.push({ meal_plan_id: planId, day_of_week: d, option_number: opt, recipe_id: pool[idx++], status: "suggested" });
      }
    }
  }

  const { error: slotsError } = await supabase.from("meal_plan_slots").insert(slots);
  if (slotsError) return slotsError.message;

  redirect("/meal-plan");
}

export async function castVote(
  slotId: string,
  memberId: string,
  value: "up" | "down" | "love"
): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";

  // Verify the memberId the client sent actually belongs to this user
  const { data: member } = await supabase
    .from("family_members")
    .select("id")
    .eq("id", memberId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return "Unauthorized";

  const { error } = await supabase.from("votes").upsert(
    { meal_plan_slot_id: slotId, member_id: memberId, value },
    { onConflict: "meal_plan_slot_id,member_id" }
  );

  if (error) return error.message;
  revalidatePath("/meal-plan");
  return null;
}
