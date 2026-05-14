"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStoresByCountry } from "../shopping-list/storeUtils";

export async function updatePreferredStores(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id, role, families(country)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return "No family found";
  if (membership.role !== "admin") return "Only family admins can change this setting";

  const country = (membership.families as { country?: string } | null)?.country ?? "ZA";
  const validKeys = new Set(getStoresByCountry(country).map((s) => s.key));
  const selected = formData.getAll("stores").map(String).filter((k) => validKeys.has(k));

  const { error } = await supabase
    .from("families")
    .update({ preferred_stores: selected })
    .eq("id", membership.family_id);

  if (error) return error.message;
  revalidatePath("/", "layout");
  return null;
}

export async function updateFamilyCountry(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";

  const rawCountry = String(formData.get("country") ?? "");
  if (!["ZA", "GB", "FR", "AU", "AE"].includes(rawCountry)) return "Invalid country";

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return "No family found";
  if (membership.role !== "admin") return "Only family admins can change this setting";

  const { error } = await supabase
    .from("families")
    .update({ country: rawCountry })
    .eq("id", membership.family_id);

  if (error) return error.message;
  revalidatePath("/", "layout");
  return null;
}
