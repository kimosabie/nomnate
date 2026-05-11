"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DIETARY_RESTRICTIONS, DIET_TYPES } from "@nomnate/types";
import { filterText } from "@/lib/contentFilter";

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

  const rawName = String(formData.get("name") ?? "");
  if (!rawName.trim()) return "Name is required";
  const dn = filterText(rawName, 60);
  if (dn.error) return dn.error;
  if (!dn.value) return "Name is required";
  const name = dn.value;

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

  // Relationship
  const VALID_RELATIONSHIPS = ["mom","dad","grandmother","grandfather","brother","sister","son","daughter","uncle","aunt","cousin","other"];
  const rawRelationship = String(formData.get("relationship") ?? "").trim();
  const relationship = VALID_RELATIONSHIPS.includes(rawRelationship) ? rawRelationship : null;

  // Date of birth → compute age
  const rawDob = String(formData.get("date_of_birth") ?? "").trim();
  let dateOfBirth: string | null = null;
  let age: number | null = null;
  if (rawDob) {
    const parsed = new Date(rawDob);
    if (!isNaN(parsed.getTime())) {
      dateOfBirth = rawDob;
      const today = new Date();
      let a = today.getFullYear() - parsed.getFullYear();
      const m = today.getMonth() - parsed.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < parsed.getDate())) a--;
      if (a >= 1 && a <= 120) age = a;
    }
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
      relationship,
      date_of_birth: dateOfBirth,
      age,
    })
    .eq("user_id", user.id);

  if (error) return error.message;

  revalidatePath("/dashboard");
  revalidatePath("/profile");
  redirect("/dashboard");
}

export async function deleteAccount(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  if (confirmation !== "DELETE") return "Type DELETE to confirm";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";

  // Find the user's family membership
  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membership) {
    // Check if this user created the family
    const { data: family } = await supabase
      .from("families")
      .select("id, created_by")
      .eq("id", membership.family_id)
      .maybeSingle();

    if (family?.created_by === user.id) {
      // Find another member to transfer ownership to (so the family survives)
      const { data: otherMembers } = await supabase
        .from("family_members")
        .select("user_id")
        .eq("family_id", membership.family_id)
        .neq("user_id", user.id)
        .limit(1);

      if (otherMembers && otherMembers.length > 0) {
        // Transfer family ownership before deleting
        await supabase
          .from("families")
          .update({ created_by: otherMembers[0].user_id })
          .eq("id", membership.family_id);
      }
      // If no other members, the family will cascade-delete when auth user is deleted — that's correct
    }
  }

  // Delete the auth user — cascades family_members (and family if still created_by)
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return error.message;

  redirect("/login?message=account_deleted");
}
