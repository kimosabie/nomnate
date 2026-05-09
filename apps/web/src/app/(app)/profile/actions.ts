"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DIETARY_RESTRICTIONS, DIET_TYPES } from "@nomnate/types";

function parseJsonStringArray(raw: FormDataEntryValue | null, maxCount: number, maxLen = 100): string[] | string {
  try {
    const parsed = JSON.parse(String(raw ?? "[]"));
    if (!Array.isArray(parsed)) return "Invalid format";
    if (!parsed.every((x) => typeof x === "string" && x.length <= maxLen)) return "Invalid format";
    if (parsed.length > maxCount) return "Too many items";
    return parsed as string[];
  } catch {
    return "Invalid format";
  }
}

export async function updatePreferences(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "Name is required";
  if (name.length > 60) return "Name must be under 60 characters";

  const rawRestrictions = formData.getAll("dietary_restrictions").map(String);
  const dietaryRestrictions = rawRestrictions.filter((r) =>
    (DIETARY_RESTRICTIONS as readonly string[]).includes(r)
  );

  const cuisinePreferences = parseJsonStringArray(formData.get("cuisine_preferences"), 20);
  if (typeof cuisinePreferences === "string") return cuisinePreferences;

  const ingredientDislikes = parseJsonStringArray(formData.get("ingredient_dislikes"), 50);
  if (typeof ingredientDislikes === "string") return ingredientDislikes;

  const allergies = parseJsonStringArray(formData.get("allergies"), 30);
  if (typeof allergies === "string") return allergies;

  const likedIngredients = parseJsonStringArray(formData.get("liked_ingredients"), 50);
  if (typeof likedIngredients === "string") return likedIngredients;

  // Diet types — validated against known values
  const rawDietTypes = parseJsonStringArray(formData.get("diet_types"), 15);
  if (typeof rawDietTypes === "string") return rawDietTypes;
  const dietTypes = rawDietTypes.filter((d) =>
    (DIET_TYPES as readonly string[]).includes(d)
  );

  // Calorie tracking
  const trackCalories = formData.get("track_calories") === "true";
  const rawCalorieTarget = formData.get("daily_calorie_target");
  let dailyCalorieTarget: number | null = null;
  if (trackCalories && rawCalorieTarget) {
    const n = Number(rawCalorieTarget);
    if (!isNaN(n) && n >= 500 && n <= 10000) dailyCalorieTarget = n;
  }

  const { error } = await supabase
    .from("family_members")
    .update({
      name,
      dietary_restrictions: dietaryRestrictions,
      cuisine_preferences: cuisinePreferences,
      ingredient_dislikes: ingredientDislikes,
      allergies,
      liked_ingredients: likedIngredients,
      diet_types: dietTypes,
      track_calories: trackCalories,
      daily_calorie_target: dailyCalorieTarget,
    })
    .eq("user_id", user.id);

  if (error) return error.message;

  revalidatePath("/dashboard");
  revalidatePath("/profile");
  redirect("/dashboard");
}
