import { createClient } from "@/lib/supabase/server";
import type { FamilyMemberContext } from "@nomnate/types";
function computeAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function buildFamilyMembers(
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

export async function getFamilyRecipePool(
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
export type NewSlotRow = {
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
export function courseSlotRows(planId: string, day: number, course: string, pool: PoolRecipe[]): NewSlotRow[] {
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


export type SlotRecipe = {
  id: string;
  title: string;
  image_url: string | null;
  prep_time: number | null;
  cuisine: string | null;
  course: string | null;
};
