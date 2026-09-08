"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertMutableMeal } from "@nomnate/shared";
import { getMutableSlot, updateMutableSlot, actionError } from "./guards";
import { createClient } from "@/lib/supabase/server";
import { currentWeekStart } from "../utils";
import { getFamilyRecipePool, courseSlotRows, type NewSlotRow } from "./helpers";
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
    .order("joined_at").order("id")
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
    .order("joined_at").order("id")
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
    const { data: currentSlots, error: readError } = await supabase.from("meal_plan_slots")
      .select("id, status, committed_draft_id").eq("meal_plan_id", planId);
    if (readError) return readError.message;
    try { for (const slot of currentSlots ?? []) assertMutableMeal(slot); }
    catch (error) { return actionError(error); }
    // The DB guard repeats this under the write lock if finalisation raced this read.
    const { error: deleteError } = await supabase.from("meal_plan_slots").delete().eq("meal_plan_id", planId);
    if (deleteError) return deleteError.message;
    // Delete shopping lists
    const { error: listError } = await supabase.from("shopping_lists").delete().eq("meal_plan_id", planId);
    if (listError) return listError.message;
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

export async function pickWildcardMeal(
  _prev: string | null,
  _formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .order("joined_at").order("id")
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
    .eq("course", "main")
    .eq("option_number", 1)
    .maybeSingle();

  if (!wedSlot) redirect("/meal-plan");
  try { await getMutableSlot(supabase, wedSlot.id, membership.family_id); }
  catch (error) { return actionError(error); }

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

  const error = await updateMutableSlot(supabase, wedSlot.id, picked);
  if (error) return error;

  revalidatePath("/meal-plan");
  revalidatePath("/dashboard");
  redirect("/meal-plan");
}
