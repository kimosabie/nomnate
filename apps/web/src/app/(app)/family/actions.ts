"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateFamilyCountry(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";

  const rawCountry = String(formData.get("country") ?? "");
  if (!["ZA", "UK", "FR"].includes(rawCountry)) return "Invalid country";

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
