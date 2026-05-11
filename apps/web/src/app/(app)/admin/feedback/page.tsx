import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TabBar } from "./TabBar";
import { TodoList } from "./TodoList";
import { ManualTrigger } from "./ManualTrigger";
import { Suspense } from "react";

const ADMIN_EMAIL = "kim.ormiston@me.com";

const TYPE_EMOJI: Record<string, string> = {
  bug: "🐛",
  idea: "💡",
  feedback: "💬",
};
const TYPE_BADGE: Record<string, string> = {
  bug: "bg-red-50 text-red-700",
  idea: "bg-turmeric-light text-turmeric-dark",
  feedback: "bg-sapphire-light text-sapphire",
};

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) redirect("/dashboard");

  const admin = createAdminClient();
  const { tab = "feedback" } = await searchParams;

  const [{ data: items }, { data: todos }] = await Promise.all([
    admin
      .from("feedback")
      .select("id, type, message, page_url, user_id, created_at, reviewed")
      .order("created_at", { ascending: false }),
    admin
      .from("todo_items")
      .select("id, title, description, priority, category, source_feedback_ids, approved, approved_at, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const userIds = [...new Set((items ?? []).map((i) => i.user_id).filter(Boolean))];
  let nameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: members } = await admin
      .from("family_members")
      .select("user_id, name")
      .in("user_id", userIds);
    for (const m of members ?? []) {
      nameMap[m.user_id] = m.name;
    }
  }

  const counts = { bug: 0, idea: 0, feedback: 0 };
  for (const item of items ?? []) {
    if (item.type in counts) counts[item.type as keyof typeof counts]++;
  }

  const unreviewedCount = (items ?? []).filter((i) => !i.reviewed).length;
  const pendingTodos = (todos ?? []).filter((t) => !t.approved).length;

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-medium text-flame">Admin</h1>
          <ManualTrigger />
        </div>

        <Suspense>
          <TabBar feedbackCount={items?.length ?? 0} todoCount={todos?.length ?? 0} />
        </Suspense>

        {tab === "feedback" && (
          <>
            <div className="flex gap-2 flex-wrap">
              {(["bug", "idea", "feedback"] as const).map((t) => (
                <span
                  key={t}
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${TYPE_BADGE[t]}`}
                >
                  {TYPE_EMOJI[t]} {counts[t]} {t}
                </span>
              ))}
              {unreviewedCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-turmeric-light text-turmeric-dark">
                  🆕 {unreviewedCount} unreviewed
                </span>
              )}
            </div>

            {!items?.length ? (
              <div className="bg-white rounded-[14px] border border-cream-border p-10 text-center">
                <p className="text-3xl mb-2">💬</p>
                <p className="text-sm text-slate">No feedback yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`bg-white rounded-[14px] border p-4 space-y-2 ${
                      item.reviewed ? "border-cream-border opacity-70" : "border-flame/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                          TYPE_BADGE[item.type] ?? "bg-cream text-slate"
                        }`}
                      >
                        {TYPE_EMOJI[item.type]} {item.type}
                      </span>
                      {item.user_id && nameMap[item.user_id] && (
                        <span className="text-xs text-slate font-medium">
                          {nameMap[item.user_id]}
                        </span>
                      )}
                      {!item.reviewed && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-turmeric-light text-turmeric-dark">
                          NEW
                        </span>
                      )}
                      <span className="text-xs text-slate ml-auto">
                        {new Date(item.created_at).toLocaleString("en-ZA", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-charcoal whitespace-pre-wrap">{item.message}</p>
                    {item.page_url && (
                      <p className="text-xs text-slate font-mono truncate">{item.page_url}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "todos" && (
          <>
            {pendingTodos > 0 && (
              <p className="text-xs text-slate">
                {pendingTodos} item{pendingTodos !== 1 ? "s" : ""} awaiting review
              </p>
            )}
            <TodoList initialTodos={todos ?? []} />
          </>
        )}
      </div>
    </main>
  );
}
