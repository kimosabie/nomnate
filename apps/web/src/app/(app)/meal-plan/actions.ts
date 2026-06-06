"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { suggestMeals } from "@nomnate/lib/claude";
import { searchRecipes } from "@nomnate/lib/spoonacular";
import type { FamilyMemberContext, SuggestedRecipe } from "@nomnate/types";
import { currentWeekStart } from "./utils";

const UNIT_ALIASES: Record<string, string> = {
  // Weight
  gram: "g", grams: "g",
  kilogram: "kg", kilograms: "kg",
  ounce: "oz", ounces: "oz",
  pound: "lb", pounds: "lb",
  // Volume
  milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml",
  liter: "l", liters: "l", litre: "l", litres: "l",
  tablespoon: "tbsp", tablespoons: "tbsp", tbs: "tbsp", tbsps: "tbsp",
  teaspoon: "tsp", teaspoons: "tsp", tsps: "tsp",
  cups: "cup",
  // Count
  cloves: "clove",
  pieces: "piece",
  cans: "can",
  slices: "slice",
  // Discard (no meaningful unit for shopping)
  whole: "", leaves: "", leaf: "", pods: "", pod: "",
  medium: "", large: "", small: "",
  stalks: "", stalk: "", sprigs: "", sprig: "",
  heads: "", head: "", bunches: "", bunch: "",
  serving: "", servings: "",  // scraped serving-count artifacts
};

// Units that signal "no quantity" — item is just listed as needed
const NO_QTY_UNITS = new Set(["to taste", "as needed", "for serving", "to garnish", "to season", "for greasing"]);

// Conversion factors to base units
const VOLUME_ML: Record<string, number> = { tsp: 5, tbsp: 15, cup: 240, ml: 1, l: 1000 };
const WEIGHT_G: Record<string, number> = { g: 1, kg: 1000, oz: 28.35, lb: 453.6 };

function fromMl(ml: number): { qty: number; unit: string } {
  if (ml >= 500) return { qty: Math.round(ml / 100) / 10, unit: "l" };
  if (ml >= 30) return { qty: Math.round(ml), unit: "ml" };
  if (ml >= 15) return { qty: Math.round((ml / 15) * 10) / 10, unit: "tbsp" };
  return { qty: Math.round((ml / 5) * 10) / 10, unit: "tsp" };
}

function fromG(g: number): { qty: number; unit: string } {
  if (g >= 900) return { qty: Math.round(g / 100) / 10, unit: "kg" };
  return { qty: Math.round(g), unit: "g" };
}

// Strip preparation notes from unit field ("tablespoon, for greasing" → "tablespoon")
function cleanUnit(unit: string | null | undefined): string {
  if (!unit) return "";
  const stripped = unit.split(",")[0].trim().toLowerCase();
  // If the entire unit is a no-qty signal, signal that upstream
  if (NO_QTY_UNITS.has(unit.toLowerCase().trim())) return "__notaste__";
  return UNIT_ALIASES[stripped] ?? stripped;
}

// Known compound ingredients that should always be split into individual items
const COMPOUND_SPLITS: Record<string, string[]> = {
  "salt and pepper": ["salt", "pepper"],
  "salt & pepper": ["salt", "pepper"],
  "salt and black pepper": ["salt", "black pepper"],
  "salt and white pepper": ["salt", "white pepper"],
};

// Expand a raw ingredient into one or more raw ingredients, splitting compounds
function expandIngredient(ing: RawIng): RawIng[] {
  const lower = ing.name.toLowerCase().trim();
  const parts = COMPOUND_SPLITS[lower];
  if (!parts) return [ing];
  // Each split part gets no quantity (they're always "to taste" in this context)
  return parts.map((p) => ({ name: p, quantity: null, unit: null }));
}

// Returns null if the ingredient should be skipped entirely (serving suggestions etc.)
function normalizeIngredientName(name: string): string | null {
  // Skip serving suggestions embedded in the name
  if (/for serving|for garnish|to serve|to garnish/i.test(name)) return null;

  return name
    .replace(/\s*\([^)]*\)/g, "")   // remove parenthetical notes: "butter (for cooking)" → "butter"
    .replace(/,\s*.+$/, "")          // remove prep notes after comma: "butter, softened" → "butter"
    .replace(/\s*\*\d+\s*$/, "")     // remove scaling artifacts: "water *2" → "water"
    .toLowerCase()
    .trim() || null;
}

type RawIng = { name: string; quantity: number | null; unit: string | null };
type ConsolidatedItem = { ingredient_name: string; quantity: number | null; unit: string | null };

function consolidateIngredients(ingredients: RawIng[]): ConsolidatedItem[] {
  // Expand compounds ("salt and pepper" → ["salt", "pepper"]) then group by normalised name
  const expanded = ingredients.flatMap(expandIngredient);
  const groups = new Map<string, { displayName: string; items: RawIng[] }>();
  for (const ing of expanded) {
    const key = normalizeIngredientName(ing.name);
    if (!key) continue; // skip blank names
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(ing);
    } else {
      // Use the shortest clean display name as the label
      groups.set(key, { displayName: key, items: [ing] });
    }
  }

  const result: ConsolidatedItem[] = [];

  for (const [, { displayName, items }] of groups) {
    const normUnits = items.map((i) => cleanUnit(i.unit));

    // Filter out "to taste" entries for quantity purposes; if ALL are "to taste" → no quantity
    const measuredItems = items.filter((_, idx) => normUnits[idx] !== "__notaste__");
    const measuredUnits = normUnits.filter((u) => u !== "__notaste__");

    if (measuredItems.length === 0) {
      // Every entry is "to taste" / unmeasured
      result.push({ ingredient_name: displayName, quantity: null, unit: null });
      continue;
    }

    // All same unit (including "")  → sum
    if (measuredUnits.every((u) => u === measuredUnits[0])) {
      const total = measuredItems.reduce((s, i) => s + (i.quantity ?? 0), 0);
      result.push({
        ingredient_name: displayName,
        quantity: total || null,
        unit: measuredUnits[0] || null,
      });
      continue;
    }

    // All volume → convert to ml, sum, reformat
    if (measuredUnits.every((u) => u in VOLUME_ML)) {
      const totalMl = measuredItems.reduce(
        (s, i, idx) => s + (i.quantity ?? 0) * (VOLUME_ML[measuredUnits[idx]] ?? 1),
        0
      );
      const { qty, unit } = fromMl(totalMl);
      result.push({ ingredient_name: displayName, quantity: qty, unit });
      continue;
    }

    // All weight → convert to g, sum, reformat
    if (measuredUnits.every((u) => u in WEIGHT_G)) {
      const totalG = measuredItems.reduce(
        (s, i, idx) => s + (i.quantity ?? 0) * (WEIGHT_G[measuredUnits[idx]] ?? 1),
        0
      );
      const { qty, unit } = fromG(totalG);
      result.push({ ingredient_name: displayName, quantity: qty, unit });
      continue;
    }

    // Mixed units → keep the entry with the most information
    const withBoth = measuredItems.filter((i, idx) => i.quantity != null && measuredUnits[idx]);
    const rep = withBoth[0] ?? measuredItems.find((i) => i.quantity != null) ?? measuredItems[0];
    const repUnit = cleanUnit(rep.unit);
    result.push({
      ingredient_name: displayName,
      quantity: rep.quantity,
      unit: repUnit && repUnit !== "__notaste__" ? repUnit : null,
    });
  }

  return result.sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name));
}

function computeAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function buildFamilyMembers(
  members: Array<{
    relationship: string | null;
    age: number | null;
    date_of_birth: string | null;
    dietary_restrictions: string[];
    allergies: string[];
    diet_types: string[];
    daily_calorie_target: number | null;
  }>
): FamilyMemberContext[] {
  return members.map((m) => ({
    relationship: m.relationship,
    age: m.date_of_birth ? computeAge(m.date_of_birth) : (m.age ?? null),
    dietaryRestrictions: (m.dietary_restrictions as string[]) ?? [],
    allergies: (m.allergies as string[]) ?? [],
    dietTypes: (m.diet_types as string[]) ?? [],
    calorieTarget: m.daily_calorie_target,
  }));
}

async function getFamilyRecipePool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  familyId: string
): Promise<Array<{ id: string; is_favourite: boolean }>> {
  const [{ data: manual }, { data: global }] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, is_favourite")
      .eq("family_id", familyId)
      .eq("is_global", false),
    supabase
      .from("family_recipes")
      .select("recipe_id, is_favourite")
      .eq("family_id", familyId),
  ]);
  return [
    ...(manual ?? []),
    ...(global ?? []).map((fr) => ({ id: fr.recipe_id, is_favourite: fr.is_favourite })),
  ];
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
  // Count AI recipes added to this family's library this week
  const { data } = await supabase
    .from("family_recipes")
    .select("recipe:recipes!inner(source)")
    .eq("family_id", familyId)
    .gte("added_at", weekStart + "T00:00:00.000Z");
  return (data ?? []).filter(
    (r) => (r.recipe as { source: string } | null)?.source === "ai"
  ).length;
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
    .select("family_id, families(country, dietary_requirements)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return "No family found";

  const familyRow = membership.families as { country?: string; dietary_requirements?: string[] } | null;
  const familyCountry = familyRow?.country ?? undefined;
  const familyDietaryRequirements = (familyRow?.dietary_requirements ?? []) as string[];

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

  // Gather family context — preferences + composition only, never PII
  const { data: members } = await supabase
    .from("family_members")
    .select("relationship, age, date_of_birth, dietary_restrictions, cuisine_preferences, ingredient_dislikes, liked_ingredients, diet_types, daily_calorie_target, allergies")
    .eq("family_id", membership.family_id);

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
  const allRestrictions = [
    ...new Set(
      (members ?? []).flatMap((m) => (m.dietary_restrictions as string[]) ?? [])
    ),
  ];
  const familySize = members?.length ?? 1;
  const familyMembers = buildFamilyMembers(members ?? []);

  // Fetch library titles + already-assigned slots this week (exclude both)
  const [{ data: manualTitles }, { data: globalLinks }, { data: currentPlan }] = await Promise.all([
    supabase.from("recipes").select("title").eq("family_id", membership.family_id).eq("is_global", false),
    supabase.from("family_recipes").select("recipe:recipes(title)").eq("family_id", membership.family_id),
    supabase.from("meal_plans").select("id").eq("family_id", membership.family_id).eq("week_start_date", weekStart).maybeSingle(),
  ]);
  const assignedThisWeek: string[] = [];
  if (currentPlan) {
    const { data: assignedSlots } = await supabase
      .from("meal_plan_slots")
      .select("recipes(title)")
      .eq("meal_plan_id", currentPlan.id)
      .not("recipe_id", "is", null);
    for (const s of assignedSlots ?? []) {
      const t = (s.recipes as { title: string } | null)?.title;
      if (t) assignedThisWeek.push(t);
    }
  }
  const excludeTitles = [
    ...(manualTitles ?? []).map((r) => r.title),
    ...(globalLinks ?? []).map((l) => (l.recipe as { title: string } | null)?.title ?? "").filter(Boolean),
    ...assignedThisWeek,
  ];
  const count = Math.min(remaining, 7);

  let suggestions: SuggestedRecipe[];
  try {
    suggestions = await suggestMeals({
      familySize,
      dietaryRestrictions: allRestrictions,
      cuisinePreferences: allCuisinePrefs,
      ingredientDislikes: allDislikes,
      likedIngredients: allLiked,
      excludeTitles,
      count,
      familyMembers,
      country: familyCountry,
      familyDietaryRequirements,
    });
  } catch (err) {
    return err instanceof Error ? err.message : "AI suggestion failed — try again";
  }

  // Fetch food photos in parallel before saving
  const imageUrls = await Promise.all(suggestions.map((s) => fetchImageByTitle(s.title)));

  // Save AI recipes globally + link to family library
  const savedIds: string[] = [];
  for (let i = 0; i < suggestions.length; i++) {
    const s = suggestions[i];
    const { data: saved, error } = await supabase
      .from("recipes")
      .insert({
        title: s.title,
        source: "ai" as const,
        source_attribution: "AI-generated recipe by Claude (Anthropic). Inspired by traditional " + s.cuisine + " cooking.",
        instructions: s.instructions,
        prep_time: s.prep_time,
        cuisine: s.cuisine,
        image_url: imageUrls[i] ?? null,
        calories_per_serving: s.calories_per_serving ?? null,
        protein_g: s.protein_g ?? null,
        carbs_g: s.carbs_g ?? null,
        fat_g: s.fat_g ?? null,
        is_global: true,
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
    await supabase.from("family_recipes").upsert(
      { family_id: membership.family_id, recipe_id: saved.id, added_by: user.id },
      { onConflict: "family_id,recipe_id", ignoreDuplicates: true }
    );
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

  // Fetch family recipe pool (manual + global-in-library)
  const recipes = await getFamilyRecipePool(supabase, membership.family_id);

  const favIds = recipes.filter((r) => r.is_favourite).map((r) => r.id);
  const otherIds = recipes.filter((r) => !r.is_favourite).map((r) => r.id);

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
    // Draw from a refilling, reshuffled queue so each day's 3 options are distinct
    // (the same recipe never appears twice in one day) and repeats are spread out.
    let queue: string[] = [];
    const draw = (usedToday: Set<string>): string => {
      if (queue.length === 0) queue = shuffle([...allIds]);
      // prefer a recipe not already shown today
      const k = queue.findIndex((id) => !usedToday.has(id));
      if (k !== -1) return queue.splice(k, 1)[0];
      // whole queue is already used today (library smaller than 3) — refill and take any
      queue = shuffle([...allIds]);
      return queue.shift()!;
    };

    for (let d = 0; d < 7; d++) {
      const usedToday = new Set<string>();
      for (let opt = 1; opt <= 3; opt++) {
        const recipeId = draw(usedToday);
        usedToday.add(recipeId);
        slots.push({
          meal_plan_id: plan.id,
          day_of_week: d,
          option_number: opt,
          recipe_id: recipeId,
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

  const items = consolidateIngredients(
    (allIngredients ?? []).map((i) => ({ name: i.name, quantity: i.quantity ?? null, unit: i.unit ?? null }))
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

  const { data: slot } = await supabase
    .from("meal_plan_slots")
    .select("id, meal_plans(family_id)")
    .eq("id", slotId)
    .single();
  if (!slot) return "Slot not found";

  const familyId = (slot.meal_plans as { family_id: string } | null)?.family_id;
  if (!familyId) return "Slot not found";

  const { data: membership } = await supabase
    .from("family_members")
    .select("id")
    .eq("family_id", familyId)
    .eq("user_id", user.id)
    .single();
  if (!membership) return "Not authorized";

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

  // Verify slot belongs to this user's family
  const { data: slot } = await supabase
    .from("meal_plan_slots")
    .select("id, meal_plans(family_id)")
    .eq("id", slotId)
    .single();
  if (!slot) return "Slot not found";
  const slotFamilyId = (slot.meal_plans as { family_id: string } | null)?.family_id;
  if (slotFamilyId !== membership.family_id) return "Not authorized";

  // Verify recipe is accessible to this family
  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, is_global, family_id")
    .eq("id", recipeId)
    .maybeSingle();
  if (!recipe) return "Recipe not found";

  if (recipe.is_global) {
    const { data: libEntry } = await supabase
      .from("family_recipes")
      .select("id")
      .eq("recipe_id", recipeId)
      .eq("family_id", membership.family_id)
      .maybeSingle();
    if (!libEntry) return "Recipe not in your library";
  } else if (recipe.family_id !== membership.family_id) {
    return "Recipe not found";
  }

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
    .select("family_id, families(country, dietary_requirements)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return { error: "No family found" };

  const slotFamilyRow = membership.families as { country?: string; dietary_requirements?: string[] } | null;
  const slotFamilyCountry = slotFamilyRow?.country ?? undefined;
  const slotFamilyDietaryRequirements = (slotFamilyRow?.dietary_requirements ?? []) as string[];

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
    .select("relationship, age, date_of_birth, dietary_restrictions, cuisine_preferences, ingredient_dislikes, liked_ingredients, diet_types, daily_calorie_target, allergies")
    .eq("family_id", membership.family_id);

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
  const allRestrictionsSlot = [
    ...new Set(
      (members ?? []).flatMap((m) => (m.dietary_restrictions as string[]) ?? [])
    ),
  ];
  const familySize = members?.length ?? 1;
  const familyMembersSlot = buildFamilyMembers(members ?? []);

  const [{ data: manualRecipes }, { data: globalRecipeLinks }] = await Promise.all([
    supabase.from("recipes").select("title").eq("family_id", membership.family_id).eq("is_global", false),
    supabase.from("family_recipes").select("recipe:recipes(title)").eq("family_id", membership.family_id),
  ]);
  const libraryTitles = [
    ...(manualRecipes ?? []).map((r) => r.title),
    ...(globalRecipeLinks ?? []).map((l) => (l.recipe as { title: string } | null)?.title ?? "").filter(Boolean),
  ];

  // Also exclude meals already assigned to other slots this week
  const { data: thisSlot } = await supabase
    .from("meal_plan_slots")
    .select("meal_plan_id")
    .eq("id", slotId)
    .single();

  let assignedTitles: string[] = [];
  if (thisSlot) {
    const { data: weekSlots } = await supabase
      .from("meal_plan_slots")
      .select("recipes(title)")
      .eq("meal_plan_id", thisSlot.meal_plan_id)
      .neq("id", slotId)
      .not("recipe_id", "is", null);
    assignedTitles = (weekSlots ?? [])
      .map((s) => (s.recipes as { title: string } | null)?.title)
      .filter((t): t is string => !!t);
  }

  const excludeTitles = [...libraryTitles, ...assignedTitles];

  let suggestions: SuggestedRecipe[];
  try {
    suggestions = await suggestMeals({
      familySize,
      dietaryRestrictions: allRestrictionsSlot,
      cuisinePreferences: allCuisinePrefs,
      ingredientDislikes: allDislikes,
      likedIngredients: allLikedSlot,
      excludeTitles,
      count: 1,
      familyMembers: familyMembersSlot,
      country: slotFamilyCountry,
      familyDietaryRequirements: slotFamilyDietaryRequirements,
    });
  } catch {
    return { error: "AI suggestions are temporarily unavailable — please try again later." };
  }

  if (!suggestions.length) return { error: "No suggestion returned" };
  const s = suggestions[0];

  const slotImageUrl = await fetchImageByTitle(s.title);

  const { data: saved, error: saveError } = await supabase
    .from("recipes")
    .insert({
      title: s.title,
      source: "ai" as const,
      source_attribution: `AI-generated recipe by Claude (Anthropic). Inspired by traditional ${s.cuisine} cooking.`,
      instructions: s.instructions,
      prep_time: s.prep_time,
      cuisine: s.cuisine,
      image_url: slotImageUrl,
      calories_per_serving: s.calories_per_serving ?? null,
      protein_g: s.protein_g ?? null,
      carbs_g: s.carbs_g ?? null,
      fat_g: s.fat_g ?? null,
      is_global: true,
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

  await supabase.from("family_recipes").upsert(
    { family_id: membership.family_id, recipe_id: saved.id, added_by: user.id },
    { onConflict: "family_id,recipe_id", ignoreDuplicates: true }
  );

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

  // Fetch family recipe pool (manual + global-in-library)
  const recipes = await getFamilyRecipePool(supabase, membership.family_id);

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

  // One vote per member per day — get this slot's day
  const { data: targetSlot } = await supabase
    .from("meal_plan_slots")
    .select("day_of_week, meal_plan_id")
    .eq("id", slotId)
    .single();
  if (!targetSlot) return "Slot not found";

  // Find any other slot the member has already voted on for this day
  const { data: dayVotes } = await supabase
    .from("votes")
    .select("meal_plan_slot_id")
    .eq("member_id", memberId)
    .neq("meal_plan_slot_id", slotId);

  if (dayVotes && dayVotes.length > 0) {
    const otherSlotIds = dayVotes.map((v) => v.meal_plan_slot_id);
    const { data: sameDay } = await supabase
      .from("meal_plan_slots")
      .select("id")
      .in("id", otherSlotIds)
      .eq("day_of_week", targetSlot.day_of_week)
      .eq("meal_plan_id", targetSlot.meal_plan_id);
    if (sameDay && sameDay.length > 0) {
      return "You've already voted for this day — one vote per day";
    }
  }

  const { error } = await supabase.from("votes").upsert(
    { meal_plan_slot_id: slotId, member_id: memberId, value },
    { onConflict: "meal_plan_slot_id,member_id" }
  );

  if (error) return error.message;
  revalidatePath("/meal-plan");
  return null;
}

export async function pickWildcardMeal(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const weekStart = currentWeekStart();

  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("family_id", membership.family_id)
    .eq("week_start_date", weekStart)
    .maybeSingle();

  // No plan yet — send to meal plan page to generate one first
  if (!plan) redirect("/meal-plan");

  // Wednesday = day_of_week 2 (week starts Monday)
  const { data: wedSlot } = await supabase
    .from("meal_plan_slots")
    .select("id, recipe_id")
    .eq("meal_plan_id", plan.id)
    .eq("day_of_week", 2)
    .eq("option_number", 1)
    .maybeSingle();

  if (!wedSlot) redirect("/meal-plan");

  // Recipes already in other slots this week (don't repeat them)
  const { data: otherSlots } = await supabase
    .from("meal_plan_slots")
    .select("recipe_id")
    .eq("meal_plan_id", plan.id)
    .neq("id", wedSlot.id)
    .not("recipe_id", "is", null);

  const usedIds = new Set((otherSlots ?? []).map((s) => s.recipe_id as string));

  // Family library (manual + global)
  const [{ data: manual }, { data: global }] = await Promise.all([
    supabase.from("recipes").select("id").eq("family_id", membership.family_id).eq("is_global", false),
    supabase.from("family_recipes").select("recipe_id").eq("family_id", membership.family_id),
  ]);

  const pool = [
    ...(manual ?? []).map((r) => r.id),
    ...(global ?? []).map((fr) => fr.recipe_id as string),
  ].filter((id) => !usedIds.has(id));

  if (pool.length === 0) redirect("/meal-plan");

  const picked = pool[Math.floor(Math.random() * pool.length)];

  await supabase
    .from("meal_plan_slots")
    .update({ recipe_id: picked })
    .eq("id", wedSlot.id);

  revalidatePath("/meal-plan");
  revalidatePath("/dashboard");
  redirect("/meal-plan");
}
