"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createFamily(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";

  const familyName = (formData.get("familyName") as string).trim();
  const displayName = (formData.get("displayName") as string).trim();
  if (!familyName) return "Family name is required";
  if (!displayName) return "Your name is required";

  const { data: family, error } = await supabase
    .from("families")
    .insert({ name: familyName, created_by: user.id })
    .select()
    .single();

  if (error) return error.message;

  // The trigger adds the creator as admin; patch their display name
  await supabase
    .from("family_members")
    .update({ name: displayName })
    .eq("family_id", family.id)
    .eq("user_id", user.id);

  revalidatePath("/", "layout");
  redirect("/dashboard");
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

  const inviteCode = (formData.get("inviteCode") as string)
    .trim()
    .toUpperCase();
  const displayName = (formData.get("displayName") as string).trim();
  if (!inviteCode) return "Invite code is required";
  if (!displayName) return "Your name is required";

  const { data: family, error: lookupError } = await supabase
    .from("families")
    .select("id, name")
    .eq("invite_code", inviteCode)
    .single();

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
    if (joinError) return joinError.message;
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
