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

  // Dietary restrictions arrive as multiple checkbox values
  const rawRestrictions = formData.getAll("dietary_restrictions").map(String);
  const dietaryRestrictions = rawRestrictions.filter((r) =>
    (DIETARY_RESTRICTIONS as readonly string[]).includes(r)
  );

  // Cuisine preferences and ingredient dislikes arrive as JSON from hidden inputs
  let cuisinePreferences: string[] = [];
  let ingredientDislikes: string[] = [];
  try {
    cuisinePreferences = JSON.parse(String(formData.get("cuisine_preferences") ?? "[]"));
    ingredientDislikes = JSON.parse(String(formData.get("ingredient_dislikes") ?? "[]"));
  } catch {
    return "Invalid preferences format";
  }

  if (!Array.isArray(cuisinePreferences) || !Array.isArray(ingredientDislikes)) {
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
