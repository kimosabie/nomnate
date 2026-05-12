import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { ManualTrigger } from "./ManualTrigger";
import { TodoList } from "./TodoList";
import { markReviewed } from "./actions";

const TYPE_EMOJI: Record<string, string> = {
  bug: "🐛",
  idea: "💡",
  feedback: "💬",
};

const TYPE_BADGE: Record<string, string> = {
  bug: "bg-red-900/40 text-red-400",
  idea: "bg-yellow-900/40 text-yellow-400",
  feedback: "bg-blue-900/40 text-blue-400",
};

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; filter?: string }>;
}) {
  const admin = createAdminClient();
  const { tab = "feedback", filter = "unreviewed" } = await searchParams;

  const [{ data: todos }, { data: archivedTodos }, { count: totalCount }, { count: unreviewedCount }] = await Promise.all([
    admin
      .from("todo_items")
      .select("id, title, description, priority, category, source_feedback_ids, approved, approved_at, created_at")
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    admin
      .from("todo_items")
      .select("id, title, priority, category, approved_at, archived_at")
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false })
      .limit(20),
    admin.from("feedback").select("id", { count: "exact", head: true }),
    admin.from("feedback").select("id", { count: "exact", head: true }).eq("reviewed", false),
  ]);

  const feedbackQuery = admin
    .from("feedback")
    .select("id, type, message, page_url, user_id, created_at, reviewed")
    .order("created_at", { ascending: false });

  if (filter === "unreviewed") feedbackQuery.eq("reviewed", false);
  if (filter === "bugs") feedbackQuery.eq("type", "bug");
  if (filter === "ideas") feedbackQuery.eq("type", "idea");

  const { data: items } = await feedbackQuery;

  const userIds = [...new Set((items ?? []).map((i) => i.user_id).filter(Boolean))];
  let nameMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: members } = await admin
      .from("family_members")
      .select("user_id, name")
      .in("user_id", userIds);
    for (const m of members ?? []) nameMap[m.user_id] = m.name;
  }

  const pendingTodos = (todos ?? []).filter((t) => !t.approved).length;

  return (
    <main className="bg-[#0f0f0f] text-white min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white">Feedback</h1>
          <Suspense><ManualTrigger /></Suspense>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-full w-fit border border-white/10">
          {[
            { key: "feedback", label: `💬 Feedback (${totalCount ?? 0})` },
            { key: "todos", label: `📋 Todos (${todos?.length ?? 0})${pendingTodos > 0 ? ` · ${pendingTodos} new` : ""}` },
          ].map((t) => (
            <a
              key={t.key}
              href={`?tab=${t.key}`}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                tab === t.key
                  ? "bg-[#E8621A] text-white"
                  : "text-white/40 hover:text-white"
              }`}
            >
              {t.label}
            </a>
          ))}
        </div>

        {tab === "feedback" && (
          <>
            {/* Filter pills */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: "unreviewed", label: `Unreviewed (${unreviewedCount ?? 0})` },
                { key: "all", label: `All (${totalCount ?? 0})` },
                { key: "bugs", label: "Bugs" },
                { key: "ideas", label: "Ideas" },
              ].map((f) => (
                <a
                  key={f.key}
                  href={`?tab=feedback&filter=${f.key}`}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                    filter === f.key
                      ? "border-[#E8621A] bg-[#E8621A] text-white"
                      : "border-white/10 text-white/50 hover:text-white"
                  }`}
                >
                  {f.label}
                </a>
              ))}
            </div>

            {!items?.length ? (
              <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
                <p className="text-3xl mb-2">✅</p>
                <p className="text-sm text-white/50">Nothing here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`bg-white/5 border rounded-xl p-4 space-y-2 ${
                      item.reviewed ? "border-white/5 opacity-50" : "border-[#E8621A]/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                          TYPE_BADGE[item.type] ?? "bg-white/10 text-white/60"
                        }`}
                      >
                        {TYPE_EMOJI[item.type]} {item.type}
                      </span>
                      {item.user_id && nameMap[item.user_id] && (
                        <span className="text-xs text-white/50">{nameMap[item.user_id]}</span>
                      )}
                      {!item.reviewed && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E8621A]/20 text-[#E8621A]">
                          NEW
                        </span>
                      )}
                      <span className="text-xs text-white/30 ml-auto">
                        {new Date(item.created_at).toLocaleString("en-ZA", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <p className="text-sm text-white/80 whitespace-pre-wrap">{item.message}</p>

                    {item.page_url && (
                      <p className="text-xs text-white/30 font-mono truncate">{item.page_url}</p>
                    )}

                    <form
                      action={async () => {
                        "use server";
                        await markReviewed(item.id, !item.reviewed);
                      }}
                    >
                      <button
                        type="submit"
                        className={`text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${
                          item.reviewed
                            ? "border-white/10 text-white/30 hover:text-white/60"
                            : "border-[#E8621A]/40 text-[#E8621A] hover:bg-[#E8621A]/10"
                        }`}
                      >
                        {item.reviewed ? "Mark unreviewed" : "Mark reviewed"}
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "todos" && (
          <>
            {pendingTodos > 0 && (
              <p className="text-xs text-white/40">
                {pendingTodos} item{pendingTodos !== 1 ? "s" : ""} awaiting review
              </p>
            )}
            <TodoList initialTodos={todos ?? []} archivedTodos={archivedTodos ?? []} />
          </>
        )}
      </div>
    </main>
  );
}
