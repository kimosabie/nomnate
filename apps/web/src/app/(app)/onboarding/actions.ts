"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { filterText } from "@/lib/contentFilter";

export async function createFamily(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";

  const rawFamilyName = String(formData.get("familyName") ?? "");
  const rawDisplayName = String(formData.get("displayName") ?? "");
  const rawCountry = String(formData.get("country") ?? "ZA");
  if (!rawFamilyName.trim()) return "Family name is required";
  if (!rawDisplayName.trim()) return "Your name is required";

  const fn = filterText(rawFamilyName, 80);
  if (fn.error) return fn.error;
  if (!fn.value) return "Family name is required";
  const familyName = fn.value;

  const dn = filterText(rawDisplayName, 60);
  if (dn.error) return dn.error;
  if (!dn.value) return "Your name is required";
  const displayName = dn.value;

  const country = ["ZA", "UK", "FR"].includes(rawCountry) ? rawCountry : "ZA";

  // SELECT policy includes created_by = auth.uid(), so RETURNING is safe here
  const { data: family, error } = await supabase
    .from("families")
    .insert({ name: familyName, created_by: user.id, country })
    .select("id")
    .single();

  if (error) return error.message;

  // Trigger has added creator as admin — patch their display name
  await supabase
    .from("family_members")
    .update({ name: displayName })
    .eq("family_id", family.id)
    .eq("user_id", user.id);

  revalidatePath("/", "layout");
  redirect("/onboarding/welcome");
}

export async function joinFamily(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";

  const inviteCode = String(formData.get("inviteCode") ?? "")
    .trim()
    .toUpperCase();
  const rawDisplayName = String(formData.get("displayName") ?? "");
  if (!inviteCode) return "Invite code is required";
  if (!rawDisplayName.trim()) return "Your name is required";

  const dn = filterText(rawDisplayName, 60);
  if (dn.error) return dn.error;
  if (!dn.value) return "Your name is required";
  const displayName = dn.value;

  const { data: families, error: lookupError } = await supabase
    .rpc("get_family_by_invite_code", { code: inviteCode });

  const family = families?.[0];
  if (lookupError || !family)
    return "Invalid invite code — double-check and try again";

  // Already a member? Just redirect
  const { data: existing } = await supabase
    .from("family_members")
    .select("id")
    .eq("family_id", family.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error: joinError } = await supabase
      .from("family_members")
      .insert({ family_id: family.id, user_id: user.id, name: displayName });

    if (joinError) {
      // 23505 = unique_violation: another request beat us here — already a member, safe to continue
      if (joinError.code !== "23505") return joinError.message;
    }
  }

  revalidatePath("/", "layout");
  redirect("/onboarding/welcome");
}
