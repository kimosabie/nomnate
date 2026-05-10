import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

export default async function AdminFeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) redirect("/dashboard");

  const admin = createAdminClient();

  const { data: items } = await admin
    .from("feedback")
    .select("id, type, message, page_url, user_id, created_at")
    .order("created_at", { ascending: false });

  // Resolve submitter display names
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

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-display font-medium text-flame">Feedback</h1>
          <span className="text-xs text-slate">{items?.length ?? 0} total</span>
        </div>

        {/* Summary pills */}
        <div className="flex gap-2 mb-6">
          {(["bug", "idea", "feedback"] as const).map((t) => (
            <span
              key={t}
              className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${TYPE_BADGE[t]}`}
            >
              {TYPE_EMOJI[t]} {counts[t]} {t}
            </span>
          ))}
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
                className="bg-white rounded-[14px] border border-cream-border p-4 space-y-2"
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
      </div>
    </main>
  );
}
