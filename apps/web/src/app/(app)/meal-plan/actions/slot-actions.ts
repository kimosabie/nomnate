"use server";

import { revalidatePath } from "next/cache";
import { assertMutableMeal } from "@nomnate/shared";
import { getMutableSlot, updateMutableSlot, actionError } from "./guards";
import { createClient } from "@/lib/supabase/server";
import { toCourse } from "@nomnate/types";
import { getFamilyRecipePool, courseSlotRows, type SlotRecipe } from "./helpers";
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
    .order("joined_at").order("id")
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

  const { data: slotRows, error: slotsError } = await supabase
    .from("meal_plan_slots")
    .select("id, status, committed_draft_id")
    .eq("meal_plan_id", planId)
    .eq("day_of_week", day)
    .eq("course", c);
  if (slotsError) return { error: slotsError.message };
  try { for (const slot of slotRows ?? []) assertMutableMeal(slot); }
  catch (error) { return { error: actionError(error) }; }
  const ids = (slotRows ?? []).map((s) => s.id);
  if (ids.length === 0) return { removedSlotIds: [] };

  // The FK deletes votes atomically with the slots; never clear votes before a protected delete.
  const { data: deleted, error } = await supabase.from("meal_plan_slots").delete().in("id", ids).select("id");
  if (error) return { error: error.message };
  if (deleted?.length !== ids.length) return { error: "Plan changed. Refresh before removing this course." };

  revalidatePath("/meal-plan");
  return { removedSlotIds: ids };
}

export async function removeFromSlot(slotId: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";

  const { data: membership, error: memberError } = await supabase.from("family_members")
    .select("family_id").eq("user_id", user.id).order("joined_at").order("id").limit(1).maybeSingle();
  if (memberError) return memberError.message;
  if (!membership) return "No active family";
  try { await getMutableSlot(supabase, slotId, membership.family_id); }
  catch (error) { return actionError(error); }
  const error = await updateMutableSlot(supabase, slotId, null);
  if (error) return error;
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
    .order("joined_at").order("id")
    .limit(1)
    .maybeSingle();
  if (!membership) return { error: "No family found" };

  let slot;
  try { slot = await getMutableSlot(supabase, slotId, membership.family_id); }
  catch (error) { return { error: actionError(error) }; }

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

  const error = await updateMutableSlot(supabase, slotId, recipeId);
  if (error) return { error };

  // Auto-reshuffle from the library (no AI): refresh this day's other suggested,
  // unvoted options of the same course and drop the chosen recipe from other days.
  let changed: ChangedSlot[];
  try { changed = await reshuffleAfterAssign(
    supabase,
    membership.family_id,
    slot.meal_plan_id as string,
    slotId,
    slot.day_of_week as number,
    (slot.course as string) ?? "main",
    recipeId
  ); } catch (error) {
    revalidatePath("/meal-plan");
    return { error: "Recipe assigned, but reshuffle failed. Refresh the plan. " + actionError(error) };
  }

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
// slots whose recipe changed so the client can update in place. Failures are
// reported as partial completion because the initial assignment has already saved.
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

  const { data: slotData, error: slotError } = await supabase
    .from("meal_plan_slots")
    .select("id, day_of_week, course, option_number, recipe_id, status")
    .eq("meal_plan_id", planId);
  if (slotError) throw new Error(slotError.message);
  const slots = (slotData ?? []) as PlanSlot[];
  if (slots.length === 0) return [];

  // Don't disturb slots that already have votes.
  const { data: voteRows, error: voteError } = await supabase
    .from("votes")
    .select("meal_plan_slot_id")
    .in("meal_plan_slot_id", slots.map((s) => s.id));
  if (voteError) throw new Error(voteError.message);
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

  for (const [sid, rid] of newRecipeBySlot) {
    const error = await updateMutableSlot(supabase, sid, rid);
    if (error) throw new Error(error);
  }

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
