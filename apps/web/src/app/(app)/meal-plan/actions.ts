"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { suggestMeals } from "@nomnate/lib/claude";
import type { SuggestedRecipe } from "@nomnate/types";
import { currentWeekStart } from "./utils";
import { FREE_AI_LIMIT } from "./constants";

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

  // Gather family context — dietary restrictions only, never PII
  const { data: members } = await supabase
    .from("family_members")
    .select("dietary_restrictions")
    .eq("family_id", membership.family_id);

  const allRestrictions = [
    ...new Set(
      (members ?? []).flatMap((m) => (m.dietary_restrictions as string[]) ?? [])
    ),
  ];
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
      excludeTitles,
      count,
    });
  } catch (err) {
    return err instanceof Error ? err.message : "AI suggestion failed — try again";
  }

  // Save generated recipes to the family library
  const savedIds: string[] = [];
  for (const s of suggestions) {
    const { data: saved, error } = await supabase
      .from("recipes")
      .insert({
        family_id: membership.family_id,
        title: s.title,
        source: "ai" as const,
        instructions: s.instructions,
        prep_time: s.prep_time,
        cuisine: s.cuisine,
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
    // Fill empty slots first, then overwrite from the start if all full
    const { data: emptySlots } = await supabase
      .from("meal_plan_slots")
      .select("id")
      .eq("meal_plan_id", existingPlan.id)
      .is("recipe_id", null);

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

    const slots = Array.from({ length: 7 }, (_, i) => ({
      meal_plan_id: plan.id,
      day_of_week: i,
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

  // Fisher-Yates shuffle for non-favourites
  for (let i = otherIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [otherIds[i], otherIds[j]] = [otherIds[j], otherIds[i]];
  }

  const orderedIds = [...favIds, ...otherIds];

  // Create the meal plan — handle race condition where another member beat us here
  const { data: plan, error: planError } = await supabase
    .from("meal_plans")
    .insert({ family_id: membership.family_id, week_start_date: weekStart })
    .select("id")
    .single();
  if (planError) {
    if (planError.code === "23505") redirect("/meal-plan"); // already created, just go there
    return planError.message;
  }

  // Create 7 slots (0=Mon … 6=Sun), assigning recipes in order
  const slots = Array.from({ length: 7 }, (_, i) => ({
    meal_plan_id: plan.id,
    day_of_week: i,
    recipe_id: orderedIds[i] ?? null,
    status: "suggested" as const,
  }));

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

  const { data: slots } = await supabase
    .from("meal_plan_slots")
    .select("recipe_id")
    .eq("meal_plan_id", plan.id)
    .not("recipe_id", "is", null);

  const recipeIds = [...new Set((slots ?? []).map((s) => s.recipe_id as string))];
  if (recipeIds.length === 0) return "No recipes in this week's plan";

  const { data: allIngredients, error: ingError } = await supabase
    .from("recipe_ingredients")
    .select("name, quantity, unit")
    .in("recipe_id", recipeIds);

  if (ingError) return ingError.message;

  type Item = { ingredient_name: string; quantity: number | null; unit: string | null };
  const map = new Map<string, Item>();
  for (const ing of allIngredients ?? []) {
    const key = `${ing.name.toLowerCase().trim()}|${(ing.unit ?? "").toLowerCase().trim()}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity =
        existing.quantity != null && ing.quantity != null
          ? existing.quantity + ing.quantity
          : null;
    } else {
      map.set(key, {
        ingredient_name: ing.name,
        quantity: ing.quantity ?? null,
        unit: ing.unit ?? null,
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
