import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  if (!user) redirect("/login");

  const { data: items } = await supabase
    .from("feedback")
    .select("id, type, message, page_url, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-display font-medium text-flame">Feedback</h1>
          <span className="text-xs text-slate">{items?.length ?? 0} submissions</span>
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
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      TYPE_BADGE[item.type] ?? "bg-cream text-slate"
                    }`}
                  >
                    {TYPE_EMOJI[item.type]} {item.type}
                  </span>
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
                  <p className="text-xs text-slate font-mono">{item.page_url}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
