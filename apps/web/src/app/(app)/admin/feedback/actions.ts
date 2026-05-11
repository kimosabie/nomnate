"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!ADMIN_EMAIL || !user || user.email !== ADMIN_EMAIL) redirect("/dashboard");
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
  try {
    const res = await fetch(`${baseUrl}/api/cron/daily-feedback`, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      cache: "no-store",
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { error: `Non-JSON response (${res.status}): ${text.slice(0, 200)}` };
    }
  } catch (err) {
    return { error: String(err) };
  }
}
