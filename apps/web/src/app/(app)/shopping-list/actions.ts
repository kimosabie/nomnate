"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const STORE_CYCLE = ["woolworths", "pnp", "checkers"] as const;

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

export async function cycleStore(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const itemId = String(formData.get("itemId") ?? "");
  const currentStore = String(formData.get("currentStore") ?? "");
  if (!itemId) return;

  const idx = STORE_CYCLE.indexOf(currentStore as typeof STORE_CYCLE[number]);
  const next = STORE_CYCLE[(idx + 1) % STORE_CYCLE.length];

  await supabase.from("shopping_list_items").update({ store: next }).eq("id", itemId);
  revalidatePath("/shopping-list");
}
