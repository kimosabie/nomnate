"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!process.env.ADMIN_EMAIL || !user || user.email !== process.env.ADMIN_EMAIL) {
    redirect("/login");
  }
}

export async function markReviewed(id: string, reviewed: boolean) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("feedback").update({ reviewed }).eq("id", id);
  revalidatePath("/admin/feedback");
}
