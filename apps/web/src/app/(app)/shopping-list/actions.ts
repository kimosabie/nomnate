"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStoresByCountry } from "./storeUtils";

async function verifyItemOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string,
  userId: string
): Promise<{ country: string } | null> {
  const { data: item } = await supabase
    .from("shopping_list_items")
    .select("id, shopping_lists(meal_plans(family_id, families(country)))")
    .eq("id", itemId)
    .single();
  if (!item) return null;

  const mealPlan = (item.shopping_lists as { meal_plans?: { family_id?: string; families?: { country?: string } | null } | null } | null)?.meal_plans;
  const familyId = mealPlan?.family_id;
  if (!familyId) return null;

  const { data: membership } = await supabase
    .from("family_members")
    .select("id")
    .eq("family_id", familyId)
    .eq("user_id", userId)
    .single();
  if (!membership) return null;

  return { country: mealPlan?.families?.country ?? "ZA" };
}

export async function toggleItem(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const itemId = String(formData.get("itemId") ?? "");
  const checked = formData.get("checked") === "true";
  if (!itemId) return;

  const ownership = await verifyItemOwnership(supabase, itemId, user.id);
  if (!ownership) return;

  await supabase.from("shopping_list_items").update({ checked }).eq("id", itemId);
  revalidatePath("/shopping-list");
}

export async function setStore(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const itemId = String(formData.get("itemId") ?? "");
  const store = String(formData.get("store") ?? "");
  if (!itemId || !store) return;

  const ownership = await verifyItemOwnership(supabase, itemId, user.id);
  if (!ownership) return;

  const validStores = new Set(getStoresByCountry(ownership.country).map((s) => s.key));
  if (!validStores.has(store)) return;

  await supabase.from("shopping_list_items").update({ store }).eq("id", itemId);
  revalidatePath("/shopping-list");
}
