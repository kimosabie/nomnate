"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMutableSlot, updateMutableSlot, actionError } from "./guards";
import { createClient } from "@/lib/supabase/server";
import { currentWeekStart } from "../utils";
import { suggestMeals } from "@nomnate/lib/claude";
import { searchRecipes } from "@nomnate/lib/spoonacular";
import type { SuggestedRecipe } from "@nomnate/types";
import { FREE_AI_LIMIT, AI_WEEK_OPTIONS_PER_DAY } from "../constants";
import { checkRateLimit } from "@/lib/rateLimit";
import { buildFamilyMembers, type NewSlotRow, type SlotRecipe } from "./helpers";
async function fetchImageByTitle(title: string): Promise<string | null> {
  try {
    const results = await searchRecipes(title, process.env.SPOONACULAR_API_KEY!, { number: 1 });
    return results[0]?.image ?? null;
  } catch {
    return null;
  }
}
export async function getAIUsageThisWeek(familyId: string): Promise<number> {
  const supabase = await createClient();
  const weekStart = currentWeekStart();
  // Count AI operations logged for this family this week (B15 ledger)
  const { count, error } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId)
    .gte("created_at", weekStart + "T00:00:00.000Z");
  if (error) throw new Error("Could not verify AI usage: " + error.message);
  return count ?? 0;
}

// Charge AI usage against the weekly budget. `units` lets a multi-recipe
// generation log several slot-equivalent uses; a week-plan logs one.
async function logAiUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  familyId: string,
  kind: "slot" | "week_plan",
  units = 1
): Promise<string | null> {
  if (units <= 0) return null;
  const { error } = await supabase
    .from("ai_usage")
    .insert(Array.from({ length: units }, () => ({ family_id: familyId, kind })));
  return error?.message ?? null;
}

export async function suggestWithAI(
  _prev: string | null,
  _formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user }, error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return "Not authenticated";

  const { data: membership, error: membershipError } = await supabase
    .from("family_members")
    .select("family_id, families(country, dietary_requirements)")
    .eq("user_id", user.id)
    .order("joined_at").order("id")
    .limit(1)
    .maybeSingle();
  if (membershipError) return membershipError.message;
  if (!membership) return "No family found";

  const familyRow = membership.families as { country?: string; dietary_requirements?: string[] } | null;
  const familyCountry = familyRow?.country ?? undefined;
  const familyDietaryRequirements = (familyRow?.dietary_requirements ?? []) as string[];

  const weekStart = currentWeekStart();
  let usedThisWeek;
  try { usedThisWeek = await getAIUsageThisWeek(membership.family_id); }
  catch (error) { return actionError(error); }
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
  const { data: members, error: membersError } = await supabase
    .from("family_members")
    .select("relationship, age, date_of_birth, dietary_restrictions, cuisine_preferences, ingredient_dislikes, liked_ingredients, diet_types, daily_calorie_target, allergies")
    .eq("family_id", membership.family_id);
  if (membersError) return "Could not load family preferences: " + membersError.message;
  if (!members?.length) return "No family members available. Refresh before generating recipes.";

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
        servings: familySize,
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
    if (error || !saved) return error?.message ?? "Failed to save AI recipe";

    if (s.ingredients.length > 0) {
      const { error: ingredientError } = await supabase.from("recipe_ingredients").insert(
        s.ingredients.map((ing) => ({
          recipe_id: saved.id,
          name: ing.name,
          quantity: ing.quantity ?? null,
          unit: ing.unit || null,
        }))
      );
      if (ingredientError) return ingredientError.message;
    }
    const { error: libraryError } = await supabase.from("family_recipes").upsert(
      { family_id: membership.family_id, recipe_id: saved.id, added_by: user.id },
      { onConflict: "family_id,recipe_id", ignoreDuplicates: true }
    );
    if (libraryError) return libraryError.message;
    savedIds.push(saved.id);
  }

  if (savedIds.length === 0) return "Failed to save AI recipes — try again";

  // Charge the weekly AI budget (one use per generated recipe — preserves prior behaviour)
  const usageError = await logAiUsage(supabase, membership.family_id, "slot", savedIds.length);
  if (usageError) return "Recipes saved, but usage recording failed: " + usageError;

  // Create or update the meal plan
  const { data: existingPlan } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("family_id", membership.family_id)
    .eq("week_start_date", weekStart)
    .maybeSingle();

  if (existingPlan) {
    // Fill empty option slots in order
    const { data: emptySlots, error: emptyError } = await supabase
      .from("meal_plan_slots")
      .select("id")
      .eq("meal_plan_id", existingPlan.id)
      .is("recipe_id", null).neq("status", "confirmed").is("committed_draft_id", null)
      .order("day_of_week")
      .order("option_number");

    if (emptyError) return emptyError.message;
    const targets = emptySlots ?? [];
    for (const [i, target] of targets.slice(0, savedIds.length).entries()) {
      const error = await updateMutableSlot(supabase, target.id, savedIds[i], true);
      if (error) return error;
    }
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

// Plan the whole week with AI in one tap: fills every empty MAIN option slot
// across the 7 days with fresh AI mains, for a single AI use. Recipes are saved
// global (NOT added to family_recipes) so the operation stays one use.
export async function planWeekWithAI(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return "Not authenticated";

  const { data: membership, error: membershipError } = await supabase
    .from("family_members")
    .select("family_id, families(country, dietary_requirements)")
    .eq("user_id", user.id)
    .order("joined_at").order("id")
    .limit(1)
    .maybeSingle();
  if (membershipError) return membershipError.message;
  if (!membership) return "No family found";
  const famRow = membership.families as { country?: string; dietary_requirements?: string[] } | null;
  const familyCountry = famRow?.country ?? undefined;
  const familyDietaryRequirements = (famRow?.dietary_requirements ?? []) as string[];

  // A whole-week plan costs ONE AI use
  let used;
  try { used = await getAIUsageThisWeek(membership.family_id); }
  catch (error) { return actionError(error); }
  if (FREE_AI_LIMIT - used <= 0) {
    return `You've used all ${FREE_AI_LIMIT} AI suggestions for this week. Upgrade to Premium for unlimited.`;
  }
  const burstOk = await checkRateLimit(supabase, user.id, "ai_week_plan", 2, 60);
  if (!burstOk) return "Too many requests — wait a moment before trying again.";

  const weekStart = currentWeekStart();
  let { data: plan } = await supabase
    .from("meal_plans").select("id")
    .eq("family_id", membership.family_id).eq("week_start_date", weekStart).maybeSingle();
  if (!plan) {
    const { data: created, error } = await supabase
      .from("meal_plans").insert({ family_id: membership.family_id, week_start_date: weekStart }).select("id").single();
    if (error || !created) {
      const { data: again } = await supabase
        .from("meal_plans").select("id").eq("family_id", membership.family_id).eq("week_start_date", weekStart).maybeSingle();
      if (!again) return error?.message ?? "Failed to create the meal plan";
      plan = again;
    } else {
      plan = created;
      const newSlots: NewSlotRow[] = [];
      for (let d = 0; d < 7; d++)
        for (let opt = 1; opt <= AI_WEEK_OPTIONS_PER_DAY; opt++)
          newSlots.push({ meal_plan_id: plan.id, day_of_week: d, course: "main", option_number: opt, recipe_id: null, status: "suggested" });
      const { error: slotError } = await supabase.from("meal_plan_slots").insert(newSlots);
      if (slotError) return slotError.message;
    }
  }

  // Empty main option slots (no recipe → no votes), capped to N options per day
  const { data: emptyMain, error: emptyError } = await supabase
    .from("meal_plan_slots")
    .select("id, day_of_week, option_number")
    .eq("meal_plan_id", plan.id).eq("course", "main").is("recipe_id", null).neq("status", "confirmed").is("committed_draft_id", null)
    .order("day_of_week").order("option_number");
  if (emptyError) return emptyError.message;
  const perDayCount = new Map<number, number>();
  const targets: { id: string; day_of_week: number; option_number: number }[] = [];
  for (const s of emptyMain ?? []) {
    const n = perDayCount.get(s.day_of_week) ?? 0;
    if (n >= AI_WEEK_OPTIONS_PER_DAY) continue;
    perDayCount.set(s.day_of_week, n + 1);
    targets.push(s);
  }
  if (targets.length === 0) return "Your week's mains are already planned.";

  // Family context (preferences only — never PII)
  const { data: members, error: membersError } = await supabase
    .from("family_members")
    .select("relationship, age, date_of_birth, dietary_restrictions, cuisine_preferences, ingredient_dislikes, liked_ingredients, diet_types, daily_calorie_target, allergies")
    .eq("family_id", membership.family_id);
  if (membersError) return "Could not load family preferences: " + membersError.message;
  if (!members?.length) return "No family members available. Refresh before generating recipes.";
  const dedupe = (key: "cuisine_preferences" | "ingredient_dislikes" | "liked_ingredients" | "dietary_restrictions") =>
    [...new Set((members ?? []).flatMap((m) => (m[key] as string[]) ?? []))];
  const familySize = members?.length ?? 1;
  const familyMembers = buildFamilyMembers(members ?? []);

  // Exclude library + already-assigned titles
  const [{ data: manualTitles }, { data: globalLinks }, { data: assignedRows }] = await Promise.all([
    supabase.from("recipes").select("title").eq("family_id", membership.family_id).eq("is_global", false),
    supabase.from("family_recipes").select("recipe:recipes(title)").eq("family_id", membership.family_id),
    supabase.from("meal_plan_slots").select("recipes(title)").eq("meal_plan_id", plan.id).not("recipe_id", "is", null),
  ]);
  const exclude = [
    ...(manualTitles ?? []).map((r) => r.title),
    ...(globalLinks ?? []).map((l) => (l.recipe as { title: string } | null)?.title ?? "").filter(Boolean),
    ...(assignedRows ?? []).map((s) => (s.recipes as { title: string } | null)?.title ?? "").filter(Boolean),
  ];

  // Generate enough mains, batched (token limits) — still ONE budget use
  const generated: SuggestedRecipe[] = [];
  while (generated.length < targets.length) {
    const batch = Math.min(7, targets.length - generated.length);
    let recipes: SuggestedRecipe[];
    try {
      recipes = await suggestMeals({
        familySize,
        dietaryRestrictions: dedupe("dietary_restrictions"),
        cuisinePreferences: dedupe("cuisine_preferences"),
        ingredientDislikes: dedupe("ingredient_dislikes"),
        likedIngredients: dedupe("liked_ingredients"),
        excludeTitles: exclude,
        count: batch,
        familyMembers,
        country: familyCountry,
        familyDietaryRequirements,
        course: "main",
      });
    } catch {
      break;
    }
    if (!recipes.length) break;
    for (const r of recipes) { generated.push(r); exclude.push(r.title); }
  }
  if (generated.length === 0) return "AI suggestions are temporarily unavailable — please try again later.";

  // Save each as a global AI recipe (NOT in family_recipes → the plan stays one
  // use) and assign to an empty main slot.
  let assigned = 0;
  let persistenceError: string | null = null;
  try {
    for (let i = 0; i < generated.length && i < targets.length; i++) {
      const g = generated[i];
      const { data: saved, error: saveError } = await supabase
        .from("recipes")
        .insert({
          title: g.title,
          source: "ai" as const,
          source_attribution: `AI-generated recipe by Claude (Anthropic). Inspired by traditional ${g.cuisine} cooking.`,
          instructions: g.instructions,
          prep_time: g.prep_time,
          servings: familySize,
          cuisine: g.cuisine,
          course: "main",
          calories_per_serving: g.calories_per_serving ?? null,
          protein_g: g.protein_g ?? null,
          carbs_g: g.carbs_g ?? null,
          fat_g: g.fat_g ?? null,
          nutrition_estimated: true,
          is_global: true,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (saveError || !saved) { persistenceError = saveError?.message ?? "Failed to save AI recipe"; break; }
      if (g.ingredients.length > 0) {
        const { error: ingredientError } = await supabase.from("recipe_ingredients").insert(
          g.ingredients.map((ing) => ({ recipe_id: saved.id, name: ing.name, quantity: ing.quantity ?? null, unit: ing.unit || null }))
        );
        if (ingredientError) { persistenceError = ingredientError.message; break; }
      }
      const assignmentError = await updateMutableSlot(supabase, targets[i].id, saved.id, true);
      if (assignmentError) { persistenceError = assignmentError; break; }
      assigned++;
    }
  } catch (error) {
    persistenceError = actionError(error);
  }
  // Charge one weekly use whenever at least one meal was assigned, including
  // partial completion. Always invalidate persisted changes, even if logging fails.
  let usageError: string | null = null;
  try {
    if (assigned > 0) usageError = await logAiUsage(supabase, membership.family_id, "week_plan");
  } catch (error) {
    usageError = actionError(error);
  } finally {
    revalidatePath("/meal-plan");
  }
  const summary = `Saved ${assigned} of ${targets.length} meals.`;
  const errors = [persistenceError, usageError ? "Usage recording failed: " + usageError : null].filter(Boolean);
  if (errors.length) return `${summary} ${errors.join("; ")} Review the plan before retrying.`;
  if (assigned < targets.length) return `${summary} AI generation stopped early; review the remaining slots.`;
  return null;
}

export async function suggestForSlot(
  slotId: string
): Promise<{ error: string } | { recipe: SlotRecipe }> {
  const supabase = await createClient();
  const {
    data: { user }, error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" };

  const { data: membership, error: membershipError } = await supabase
    .from("family_members")
    .select("family_id, families(country, dietary_requirements)")
    .eq("user_id", user.id)
    .order("joined_at").order("id")
    .limit(1)
    .maybeSingle();
  if (membershipError) return { error: membershipError.message };
  if (!membership) return { error: "No family found" };

  let thisSlot;
  try { thisSlot = await getMutableSlot(supabase, slotId, membership.family_id); }
  catch (error) { return { error: actionError(error) }; }
  const slotCourse = thisSlot.course;

  const slotFamilyRow = membership.families as { country?: string; dietary_requirements?: string[] } | null;
  const slotFamilyCountry = slotFamilyRow?.country ?? undefined;
  const slotFamilyDietaryRequirements = (slotFamilyRow?.dietary_requirements ?? []) as string[];

  let usedThisWeek;
  try { usedThisWeek = await getAIUsageThisWeek(membership.family_id); }
  catch (error) { return { error: actionError(error) }; }
  if (FREE_AI_LIMIT - usedThisWeek <= 0) {
    return { error: `You've used all ${FREE_AI_LIMIT} AI suggestions for this week` };
  }

  const burstOk = await checkRateLimit(supabase, user.id, "ai_suggest", 2, 60);
  if (!burstOk) {
    return { error: "Too many requests — wait a moment before trying again." };
  }

  const { data: members, error: membersError } = await supabase
    .from("family_members")
    .select("relationship, age, date_of_birth, dietary_restrictions, cuisine_preferences, ingredient_dislikes, liked_ingredients, diet_types, daily_calorie_target, allergies")
    .eq("family_id", membership.family_id);
  if (membersError) return { error: "Could not load family preferences: " + membersError.message };
  if (!members?.length) return { error: "No family members available. Refresh before generating recipes." };

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
      servings: familySize,
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
    const { error: ingredientError } = await supabase.from("recipe_ingredients").insert(
      s.ingredients.map((ing) => ({
        recipe_id: saved.id,
        name: ing.name,
        quantity: ing.quantity ?? null,
        unit: ing.unit || null,
      }))
    );
    if (ingredientError) return { error: ingredientError.message };
  }

  const { error: libraryError } = await supabase.from("family_recipes").upsert(
    { family_id: membership.family_id, recipe_id: saved.id, added_by: user.id },
    { onConflict: "family_id,recipe_id", ignoreDuplicates: true }
  );

  if (libraryError) return { error: libraryError.message };

  const updateError = await updateMutableSlot(supabase, slotId, saved.id);
  if (updateError) return { error: updateError };

  // Charge one AI use against the weekly budget (B15 ledger)
  const usageError = await logAiUsage(supabase, membership.family_id, "slot");
  if (usageError) return { error: "Meal saved, but usage recording failed: " + usageError };

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
