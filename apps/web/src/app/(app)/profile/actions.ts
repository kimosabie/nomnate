"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DIETARY_RESTRICTIONS } from "@nomnate/types";

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

  // Dietary restrictions arrive as multiple checkbox values
  const rawRestrictions = formData.getAll("dietary_restrictions").map(String);
  const dietaryRestrictions = rawRestrictions.filter((r) =>
    (DIETARY_RESTRICTIONS as readonly string[]).includes(r)
  );

  // Cuisine preferences and ingredient dislikes arrive as JSON from hidden inputs
  let cuisinePreferences: string[] = [];
  let ingredientDislikes: string[] = [];
  try {
    const rawCuisines = JSON.parse(String(formData.get("cuisine_preferences") ?? "[]"));
    const rawDislikes = JSON.parse(String(formData.get("ingredient_dislikes") ?? "[]"));

    if (!Array.isArray(rawCuisines) || !Array.isArray(rawDislikes)) {
      return "Invalid preferences format";
    }
    const isValidStrings = (arr: unknown[]) =>
      arr.every((x) => typeof x === "string" && x.length <= 100);
    if (!isValidStrings(rawCuisines) || !isValidStrings(rawDislikes)) {
      return "Invalid preferences format";
    }
    if (rawCuisines.length > 20 || rawDislikes.length > 50) {
      return "Too many preferences";
    }

    cuisinePreferences = rawCuisines as string[];
    ingredientDislikes = rawDislikes as string[];
  } catch {
    return "Invalid preferences format";
  }

  const { error } = await supabase
    .from("family_members")
    .update({
      name,
      dietary_restrictions: dietaryRestrictions,
      cuisine_preferences: cuisinePreferences,
      ingredient_dislikes: ingredientDislikes,
    })
    .eq("user_id", user.id);

  if (error) return error.message;

  revalidatePath("/dashboard");
  revalidatePath("/profile");
  redirect("/dashboard");
}
