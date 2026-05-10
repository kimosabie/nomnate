"use server";

import { createClient } from "@/lib/supabase/server";

export async function setItemStore(itemId: string, store: string | null): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const valid = ["woolworths", "pnp", "checkers", null];
  if (!valid.includes(store)) return;

  await supabase
    .from("shopping_list_items")
    .update({ store })
    .eq("id", itemId);
}

export async function toggleItem(itemId: string, checked: boolean): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";

  const { error } = await supabase
    .from("shopping_list_items")
    .update({ checked })
    .eq("id", itemId);

  if (error) return error.message;
  return null;
}
