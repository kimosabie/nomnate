"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { processFeedback } from "@/lib/processFeedback";

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

export async function approveTodo(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin
    .from("todo_items")
    .update({ approved: true, approved_at: new Date().toISOString() })
    .eq("id", id);
}

export async function dismissTodo(id: string) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("todo_items").delete().eq("id", id);
}

export async function runDailyBrief() {
  await requireAdmin();
  return processFeedback();
}
