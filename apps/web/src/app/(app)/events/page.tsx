import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listEvents } from "./actions";
import { NewEventForm } from "./NewEventForm";

const TYPE_EMOJI: Record<string, string> = {
  braai: "🔥",
  party: "🎉",
  dinner: "🍽",
  other: "✨",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "No date set";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function EventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await listEvents();

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 py-4">
        <h1 className="text-2xl font-display font-medium text-flame">Events</h1>
        <p className="text-xs text-slate mt-1">Plan a braai or party — build a menu and a shopping list.</p>
      </div>
      <div className="max-w-3xl mx-auto px-4 pb-8 space-y-4">
        <NewEventForm />

        {"error" in result ? (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{result.error}</p>
        ) : result.events.length === 0 ? (
          <p className="text-sm text-slate text-center py-6">No events yet — plan your first one above.</p>
        ) : (
          <div className="space-y-2">
            {result.events.map((e) => (
              <Link
                key={e.id}
                href={`/events/${e.id}`}
                className="flex items-center gap-3 bg-white rounded-[14px] border border-cream-border p-4 hover:border-flame/40 transition-colors"
              >
                <span className="text-2xl shrink-0">{TYPE_EMOJI[e.event_type ?? "other"] ?? "✨"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-charcoal truncate">{e.name}</p>
                  <p className="text-xs text-slate">{fmtDate(e.event_date)} · {e.guest_count} guests</p>
                </div>
                <span className="text-flame text-sm shrink-0">→</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
