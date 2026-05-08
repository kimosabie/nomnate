"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  revalidatePath("/shopping-list");
  return null;
}
