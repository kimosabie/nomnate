"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DIET_TYPES } from "@nomnate/types";

export async function addManualRecipe(
  _prev: string | null,
  formData: FormData
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

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return "Recipe name is required";
  if (title.length > 200) return "Name must be under 200 characters";

  const description = String(formData.get("description") ?? "").trim() || null;
  const cuisine = String(formData.get("cuisine") ?? "").trim() || null;
  const prepTime = formData.get("prep_time") ? Number(formData.get("prep_time")) || null : null;
  const cookTime = formData.get("cook_time") ? Number(formData.get("cook_time")) || null : null;
  const servings = formData.get("servings") ? Number(formData.get("servings")) || null : null;
  const caloriesPerServing = formData.get("calories_per_serving")
    ? Number(formData.get("calories_per_serving")) || null
    : null;

  const rawDietTypes = formData.getAll("diet_types").map(String);
  const dietTypes = rawDietTypes.filter((d) =>
    (DIET_TYPES as readonly string[]).includes(d)
  );

  let ingredients: Array<{ name: string; quantity: number | null; unit: string | null }> = [];
  try {
    const raw = JSON.parse(String(formData.get("ingredients_json") ?? "[]"));
    if (Array.isArray(raw)) {
      ingredients = raw
        .filter((i) => typeof i.name === "string" && i.name.trim())
        .map((i) => ({
          name: String(i.name).trim().toLowerCase(),
          quantity: i.quantity != null && i.quantity !== "" ? Number(i.quantity) || null : null,
          unit: i.unit?.trim() || null,
        }))
        .slice(0, 100);
    }
  } catch { /* invalid json — just skip */ }

  let instructionText: string | null = null;
  try {
    const raw = JSON.parse(String(formData.get("steps_json") ?? "[]"));
    if (Array.isArray(raw)) {
      const steps = raw.filter((s) => typeof s === "string" && s.trim());
      if (steps.length > 0) {
        instructionText = steps.map((s: string, i: number) => `${i + 1}. ${s.trim()}`).join("\n");
      }
    }
  } catch { /* invalid json — just skip */ }

  let imageUrl: string | null = null;
  const imageFile = formData.get("image") as File | null;
  if (imageFile && imageFile.size > 0) {
    if (imageFile.size > 5 * 1024 * 1024) return "Image must be under 5 MB";
    const ext = imageFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${membership.family_id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("recipe-images")
      .upload(path, imageFile, { contentType: imageFile.type });
    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from("recipe-images")
        .getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }
  }

  const { data: recipe, error } = await supabase
    .from("recipes")
    .insert({
      family_id: membership.family_id,
      title,
      description,
      cuisine,
      prep_time: prepTime,
      cook_time: cookTime,
      servings,
      calories_per_serving: caloriesPerServing,
      diet_types: dietTypes,
      instructions: instructionText,
      image_url: imageUrl,
      source: "manual" as const,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !recipe) return error?.message ?? "Failed to save recipe";

  if (ingredients.length > 0) {
    await supabase
      .from("recipe_ingredients")
      .insert(ingredients.map((ing) => ({ recipe_id: recipe.id, ...ing })));
  }

  revalidatePath("/recipes");
  redirect(`/recipes/${recipe.id}`);
}
