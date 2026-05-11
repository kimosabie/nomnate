"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { filterText } from "@/lib/contentFilter";
import { DIETARY_RESTRICTIONS } from "@nomnate/types";

const VALID_RELATIONSHIPS = ["mom","dad","grandmother","grandfather","brother","sister","son","daughter","uncle","aunt","cousin","other"];

export async function completeSetup(
  _prev: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";

  const rawName = String(formData.get("name") ?? "");
  if (!rawName.trim()) return "Name is required";
  const dn = filterText(rawName, 60);
  if (dn.error) return dn.error;
  if (!dn.value) return "Name is required";
  const name = dn.value;

  const rawRelationship = String(formData.get("relationship") ?? "").trim();
  const relationship = VALID_RELATIONSHIPS.includes(rawRelationship) ? rawRelationship : null;

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

  const rawRestrictions = formData.getAll("dietary_restrictions").map(String);
  const dietaryRestrictions = rawRestrictions.filter((r) =>
    (DIETARY_RESTRICTIONS as readonly string[]).includes(r)
  );

  const { error } = await supabase
    .from("family_members")
    .update({ name, relationship, date_of_birth: dateOfBirth, age, dietary_restrictions: dietaryRestrictions })
    .eq("user_id", user.id);

  if (error) return error.message;

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
