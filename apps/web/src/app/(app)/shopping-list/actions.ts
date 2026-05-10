"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const VALID_STORES = new Set(["woolworths", "pnp", "checkers"]);

export async function toggleItem(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const itemId = String(formData.get("itemId") ?? "");
  const checked = formData.get("checked") === "true";
  if (!itemId) return;

  await supabase.from("shopping_list_items").update({ checked }).eq("id", itemId);
  revalidatePath("/shopping-list");
}

export async function setStore(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const itemId = String(formData.get("itemId") ?? "");
  const store = String(formData.get("store") ?? "");
  if (!itemId || !VALID_STORES.has(store)) return;

  await supabase.from("shopping_list_items").update({ store }).eq("id", itemId);
  revalidatePath("/shopping-list");
}
