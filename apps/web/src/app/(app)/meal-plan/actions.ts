"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { suggestMeals } from "@nomnate/lib/claude";
import { searchRecipes } from "@nomnate/lib/spoonacular";
import type { FamilyMemberContext, SuggestedRecipe } from "@nomnate/types";
import { toCourse } from "@nomnate/types";
import { currentWeekStart } from "./utils";
import { consolidateIngredients } from "@/lib/ingredients";


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
): Promise<Array<{ id: string; is_favourite: boolean; course: string | null }>> {
  const [{ data: manual }, { data: global }] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, is_favourite, course")
      .eq("family_id", familyId)
      .eq("is_global", false),
    supabase
      .from("family_recipes")
      .select("recipe_id, is_favourite, recipe:recipes(course)")
      .eq("family_id", familyId),
  ]);
  return [
    ...((manual ?? []) as Array<{ id: string; is_favourite: boolean; course: string | null }>),
    ...(global ?? []).map((fr) => ({
      id: fr.recipe_id,
      is_favourite: fr.is_favourite,
      course: (fr.recipe as { course: string | null } | null)?.course ?? null,
    })),
  ];
}

type PoolRecipe = { id: string; is_favourite: boolean; course: string | null };
type NewSlotRow = {
  meal_plan_id: string;
  day_of_week: number;
  course: string;
  option_number: number;
  recipe_id: string | null;
  status: "suggested";
};

function shuffleIds<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Distinct recipe ids eligible for a course (favourites first), augmented with
// unclassified recipes when the exact-course pool is thin (<3). Re-shuffled per call.
function courseCandidateIds(pool: PoolRecipe[], course: string): string[] {
  let cands = pool.filter((r) => r.course === course);
  if (cands.length < 3) {
    const have = new Set(cands.map((c) => c.id));
    cands = [...cands, ...pool.filter((r) => r.course == null && !have.has(r.id))];
  }
  const favs = shuffleIds(cands.filter((c) => c.is_favourite).map((c) => c.id));
  const others = shuffleIds(cands.filter((c) => !c.is_favourite).map((c) => c.id));
  return [...favs, ...others];
}

// Build the option slot rows for one (day, course): up to 3 distinct dishes from
// the course's candidates (a thin pool just yields fewer options; none yields a
// single empty slot so the course still shows with an "add recipe" prompt).
function courseSlotRows(planId: string, day: number, course: string, pool: PoolRecipe[]): NewSlotRow[] {
  const ids = courseCandidateIds(pool, course);
  if (ids.length === 0) {
    return [{ meal_plan_id: planId, day_of_week: day, course, option_number: 1, recipe_id: null, status: "suggested" }];
  }
  return ids.slice(0, Math.min(3, ids.length)).map((recipe_id, i) => ({
    meal_plan_id: planId,
    day_of_week: day,
    course,
    option_number: i + 1,
    recipe_id,
    status: "suggested" as const,
  }));
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
  // Count AI operations logged for this family this week (B15 ledger)
  const { count } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId)
    .gte("created_at", weekStart + "T00:00:00.000Z");
  return count ?? 0;
}

// Charge AI usage against the weekly budget. `units` lets a multi-recipe
// generation log several slot-equivalent uses; a week-plan logs one.
async function logAiUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  familyId: string,
  kind: "slot" | "week_plan",
  units = 1
): Promise<void> {
  if (units <= 0) return;
  await supabase
    .from("ai_usage")
    .insert(Array.from({ length: units }, () => ({ family_id: familyId, kind })));
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
    return `You've used all ${FREE_AI_LIMIT} AI suggestions for this week. Upgrade to Premium for unlimited.`;
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

  // Charge the weekly AI budget (one use per generated recipe — preserves prior behaviour)
  await logAiUsage(supabase, membership.family_id, "slot", savedIds.length);

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
    .select("family_id, families(courses)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return "No family found";

  const familyCourses = (membership.families as { courses?: string[] } | null)?.courses;
  const courses = familyCourses && familyCourses.length > 0 ? familyCourses : ["main"];

  const weekStart = currentWeekStart();

  // Idempotent — if a plan already exists this week, just navigate there
  const { data: existing } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("family_id", membership.family_id)
    .eq("week_start_date", weekStart)
    .maybeSingle();
  if (existing) redirect("/meal-plan");

  // Fetch family recipe pool (manual + global-in-library), with course tags
  const recipes = await getFamilyRecipePool(supabase, membership.family_id);

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

  // For each day × each configured course, build that course's option slots.
  const slots: NewSlotRow[] = [];
  for (let d = 0; d < 7; d++) {
    for (const course of courses) {
      slots.push(...courseSlotRows(plan.id, d, course, recipes));
    }
  }

  const { error: slotsError } = await supabase
    .from("meal_plan_slots")
    .insert(slots);
  if (slotsError) return slotsError.message;

  redirect("/meal-plan");
}

type ClientSlot = {
  id: string;
  day_of_week: number;
  course: string;
  option_number: number;
  status: "suggested" | "voted" | "confirmed";
  recipe: SlotRecipe | null;
};

// Verify the caller is an admin of the plan's family. Returns the family id or an error.
async function authoriseCourseEdit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string
): Promise<{ error: string } | { familyId: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return { error: "No family found" };
  if (membership.role !== "admin") return { error: "Only family admins can change the plan layout" };

  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, family_id")
    .eq("id", planId)
    .maybeSingle();
  if (!plan || plan.family_id !== membership.family_id) return { error: "Not authorized" };

  return { familyId: membership.family_id };
}

// Opt a single day into a course (Starter/Dessert) — creates that day's option
// slots from the course-filtered library. Idempotent; admin-only; main is implicit.
export async function addCourseToDay(
  planId: string,
  day: number,
  course: string
): Promise<{ error: string } | { slots: ClientSlot[] }> {
  const c = toCourse(course);
  if (!c || c === "main") return { error: "That course can't be added" };

  const supabase = await createClient();
  const auth = await authoriseCourseEdit(supabase, planId);
  if ("error" in auth) return auth;

  // Idempotent — if the course already exists for the day, do nothing
  const { data: existing } = await supabase
    .from("meal_plan_slots")
    .select("id")
    .eq("meal_plan_id", planId)
    .eq("day_of_week", day)
    .eq("course", c)
    .limit(1);
  if (existing && existing.length > 0) return { slots: [] };

  const pool = await getFamilyRecipePool(supabase, auth.familyId);
  const rows = courseSlotRows(planId, day, c, pool);
  const { data: inserted, error } = await supabase
    .from("meal_plan_slots")
    .insert(rows)
    .select("id, day_of_week, course, option_number, status, recipe_id");
  if (error || !inserted) return { error: error?.message ?? "Failed to add course" };

  const recipeIds = [...new Set(inserted.map((s) => s.recipe_id).filter(Boolean))] as string[];
  const recipeById = new Map<string, SlotRecipe>();
  if (recipeIds.length > 0) {
    const { data: recipeRows } = await supabase
      .from("recipes")
      .select("id, title, image_url, prep_time, cuisine, course")
      .in("id", recipeIds);
    for (const r of recipeRows ?? []) recipeById.set(r.id, r as SlotRecipe);
  }

  revalidatePath("/meal-plan");
  return {
    slots: inserted.map((s) => ({
      id: s.id,
      day_of_week: s.day_of_week,
      course: s.course,
      option_number: s.option_number,
      status: s.status as ClientSlot["status"],
      recipe: s.recipe_id ? (recipeById.get(s.recipe_id) ?? null) : null,
    })),
  };
}

// Remove a course (Starter/Dessert) from a single day. Admin-only; main can't be
// removed. Votes on the removed slots are deleted (the caller confirms first).
export async function removeCourseFromDay(
  planId: string,
  day: number,
  course: string
): Promise<{ error: string } | { removedSlotIds: string[] }> {
  const c = toCourse(course);
  if (!c || c === "main") return { error: "The main course can't be removed" };

  const supabase = await createClient();
  const auth = await authoriseCourseEdit(supabase, planId);
  if ("error" in auth) return auth;

  const { data: slotRows } = await supabase
    .from("meal_plan_slots")
    .select("id")
    .eq("meal_plan_id", planId)
    .eq("day_of_week", day)
    .eq("course", c);
  const ids = (slotRows ?? []).map((s) => s.id);
  if (ids.length === 0) return { removedSlotIds: [] };

  // Defensive: clear any votes first in case the FK isn't cascading.
  await supabase.from("votes").delete().in("meal_plan_slot_id", ids);
  const { error } = await supabase.from("meal_plan_slots").delete().in("id", ids);
  if (error) return { error: error.message };

  revalidatePath("/meal-plan");
  return { removedSlotIds: ids };
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

  // For each (day, course), use the confirmed option first, then the lowest option_number with a recipe
  const { data: allSlots } = await supabase
    .from("meal_plan_slots")
    .select("day_of_week, course, option_number, recipe_id, status")
    .eq("meal_plan_id", plan.id)
    .not("recipe_id", "is", null)
    .order("day_of_week")
    .order("option_number");

  // Pick one recipe per (day, course) (confirmed > lowest option_number > first available)
  const pickMap = new Map<string, string>();
  for (const s of allSlots ?? []) {
    const key = `${s.day_of_week}|${s.course}`;
    const existing = pickMap.get(key);
    if (!existing || s.status === "confirmed") {
      pickMap.set(key, s.recipe_id as string);
    }
  }
  const recipeIds = [...new Set(pickMap.values())];
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

export type ChangedSlot = { slotId: string; recipe: SlotRecipe | null };

export async function assignRecipeToSlot(
  slotId: string,
  recipeId: string
): Promise<{ error: string } | { changed: ChangedSlot[] }> {
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

  // Verify slot belongs to this user's family
  const { data: slot } = await supabase
    .from("meal_plan_slots")
    .select("id, meal_plan_id, day_of_week, course, meal_plans(family_id)")
    .eq("id", slotId)
    .single();
  if (!slot) return { error: "Slot not found" };
  const slotFamilyId = (slot.meal_plans as { family_id: string } | null)?.family_id;
  if (slotFamilyId !== membership.family_id) return { error: "Not authorized" };

  // Verify recipe is accessible to this family
  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, is_global, family_id, course")
    .eq("id", recipeId)
    .maybeSingle();
  if (!recipe) return { error: "Recipe not found" };

  if (recipe.is_global) {
    const { data: libEntry } = await supabase
      .from("family_recipes")
      .select("id")
      .eq("recipe_id", recipeId)
      .eq("family_id", membership.family_id)
      .maybeSingle();
    if (!libEntry) return { error: "Recipe not in your library" };
  } else if (recipe.family_id !== membership.family_id) {
    return { error: "Recipe not found" };
  }

  // Course enforcement: keep desserts and savoury courses apart (unclassified
  // recipes are allowed anywhere; starter/main/side are interchangeable).
  const slotCourse = (slot.course as string) ?? "main";
  if (recipe.course === "dessert" && slotCourse !== "dessert") {
    return { error: "That's a dessert — it can't go in a savoury course." };
  }
  if (recipe.course && recipe.course !== "dessert" && slotCourse === "dessert") {
    return { error: "Only a dessert can go in the dessert course." };
  }

  const { error } = await supabase
    .from("meal_plan_slots")
    .update({ recipe_id: recipeId })
    .eq("id", slotId);

  if (error) return { error: error.message };

  // Auto-reshuffle from the library (no AI): refresh this day's other suggested,
  // unvoted options of the same course and drop the chosen recipe from other days.
  const changed = await reshuffleAfterAssign(
    supabase,
    membership.family_id,
    slot.meal_plan_id as string,
    slotId,
    slot.day_of_week as number,
    (slot.course as string) ?? "main",
    recipeId
  );

  revalidatePath("/meal-plan");
  return { changed };
}

type PlanSlot = {
  id: string;
  day_of_week: number;
  course: string;
  option_number: number;
  recipe_id: string | null;
  status: string;
};

// When a recipe is picked for a slot, keep the daily options fresh without
// spending an AI call: re-roll the same day's other suggested+unvoted options
// *of the same course* from the family library and replace the chosen recipe
// wherever it appears as an option of that course on other days. Returns the
// slots whose recipe changed so the client can update in place. Best-effort —
// never blocks the assignment it follows.
async function reshuffleAfterAssign(
  supabase: Awaited<ReturnType<typeof createClient>>,
  familyId: string,
  planId: string,
  assignedSlotId: string,
  assignedDay: number,
  assignedCourse: string,
  assignedRecipeId: string
): Promise<ChangedSlot[]> {
  // Re-roll only from recipes of the same course (augmented with unclassified
  // recipes when that course pool is thin) so we never inject a wrong-course dish.
  const pool = await getFamilyRecipePool(supabase, familyId);
  let libraryIds = pool.filter((r) => r.course === assignedCourse).map((r) => r.id);
  if (libraryIds.length < 3) {
    const have = new Set(libraryIds);
    libraryIds = [...libraryIds, ...pool.filter((r) => r.course == null && !have.has(r.id)).map((r) => r.id)];
  }
  if (libraryIds.length === 0) return [];

  const { data: slotData } = await supabase
    .from("meal_plan_slots")
    .select("id, day_of_week, course, option_number, recipe_id, status")
    .eq("meal_plan_id", planId);
  const slots = (slotData ?? []) as PlanSlot[];
  if (slots.length === 0) return [];

  // Don't disturb slots that already have votes.
  const { data: voteRows } = await supabase
    .from("votes")
    .select("meal_plan_slot_id")
    .in("meal_plan_slot_id", slots.map((s) => s.id));
  const votedSlotIds = new Set((voteRows ?? []).map((v) => v.meal_plan_slot_id));

  // Only ever touch slots of the same course as the one just assigned.
  const isRerollable = (s: PlanSlot) =>
    s.id !== assignedSlotId &&
    s.course === assignedCourse &&
    s.status === "suggested" &&
    !votedSlotIds.has(s.id);

  // (a) other options on the assigned day; (b) the chosen recipe wherever else it appears
  const targets = slots.filter(
    (s) => isRerollable(s) && (s.day_of_week === assignedDay || s.recipe_id === assignedRecipeId)
  );
  if (targets.length === 0) return [];

  const shuffled = [...libraryIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  let cursor = 0;
  const nextPick = (excluded: Set<string>): string | null => {
    for (let n = 0; n < shuffled.length; n++) {
      const cand = shuffled[(cursor + n) % shuffled.length];
      if (!excluded.has(cand)) {
        cursor = (cursor + n + 1) % shuffled.length;
        return cand;
      }
    }
    return null;
  };

  const slotsByDay = new Map<number, PlanSlot[]>();
  for (const s of slots) {
    const arr = slotsByDay.get(s.day_of_week) ?? [];
    arr.push(s);
    slotsByDay.set(s.day_of_week, arr);
  }
  const targetsByDay = new Map<number, PlanSlot[]>();
  for (const t of targets) {
    const arr = targetsByDay.get(t.day_of_week) ?? [];
    arr.push(t);
    targetsByDay.set(t.day_of_week, arr);
  }

  const newRecipeBySlot = new Map<string, string>();
  for (const [day, dayTargets] of targetsByDay) {
    // Keep within-day distinctness and never reintroduce the just-chosen recipe.
    const kept = new Set<string>([assignedRecipeId]);
    const targetIds = new Set(dayTargets.map((t) => t.id));
    for (const s of slotsByDay.get(day) ?? []) {
      if (!targetIds.has(s.id) && s.recipe_id) kept.add(s.recipe_id);
    }
    const picked = new Set<string>();
    for (const t of dayTargets) {
      const pick = nextPick(new Set<string>([...kept, ...picked]));
      if (pick) {
        newRecipeBySlot.set(t.id, pick);
        picked.add(pick);
      }
    }
  }
  if (newRecipeBySlot.size === 0) return [];

  await Promise.all(
    [...newRecipeBySlot.entries()].map(([sid, rid]) =>
      supabase.from("meal_plan_slots").update({ recipe_id: rid }).eq("id", sid)
    )
  );

  const { data: recipeRows } = await supabase
    .from("recipes")
    .select("id, title, image_url, prep_time, cuisine, course")
    .in("id", [...new Set(newRecipeBySlot.values())]);
  const recipeById = new Map((recipeRows ?? []).map((r) => [r.id, r as SlotRecipe]));

  return [...newRecipeBySlot.entries()].map(([sid, rid]) => ({
    slotId: sid,
    recipe: recipeById.get(rid) ?? null,
  }));
}

type SlotRecipe = {
  id: string;
  title: string;
  image_url: string | null;
  prep_time: number | null;
  cuisine: string | null;
  course: string | null;
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
    return { error: `You've used all ${FREE_AI_LIMIT} AI suggestions for this week` };
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
    .select("meal_plan_id, course")
    .eq("id", slotId)
    .single();
  const slotCourse = (thisSlot?.course as string) ?? "main";

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
      course: slotCourse,
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
      course: slotCourse,
      calories_per_serving: s.calories_per_serving ?? null,
      protein_g: s.protein_g ?? null,
      carbs_g: s.carbs_g ?? null,
      fat_g: s.fat_g ?? null,
      is_global: true,
      created_by: user.id,
    })
    .select("id, title, image_url, prep_time, cuisine, course")
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

  // Charge one AI use against the weekly budget (B15 ledger)
  await logAiUsage(supabase, membership.family_id, "slot");

  revalidatePath("/meal-plan");
  return {
    recipe: {
      id: saved.id,
      title: saved.title,
      image_url: saved.image_url ?? null,
      prep_time: saved.prep_time ?? null,
      cuisine: saved.cuisine ?? null,
      course: saved.course ?? null,
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
