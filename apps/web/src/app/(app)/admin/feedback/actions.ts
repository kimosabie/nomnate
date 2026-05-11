"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAIL = "kim.ormiston@me.com";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) redirect("/dashboard");
  return user;
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
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.nomnate.co.za";
  const res = await fetch(`${baseUrl}/api/cron/daily-feedback`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    cache: "no-store",
  });
  const json = await res.json();
  return json;
}
