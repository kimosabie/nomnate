import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentWeekStart } from "../meal-plan/utils";
import { CopyCode } from "./CopyCode";

const DAY_MS = 86_400_000;

function computeStreak(voteDates: Set<number>): number {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  // If not voted today, we still count yesterday as the streak start
  let cursor = voteDates.has(today.getTime())
    ? today.getTime()
    : today.getTime() - DAY_MS;
  let streak = 0;
  for (let d = cursor; d >= cursor - 365 * DAY_MS; d -= DAY_MS) {
    if (voteDates.has(d)) streak++;
    else break;
  }
  return streak;
}

function wildcardLabel(): { label: string; sub: string } {
  const today = new Date();
  const dow = today.getUTCDay(); // 0=Sun, 3=Wed
  if (dow === 3) return { label: "Today! 🎲", sub: "wildcard day" };
  const days = (3 - dow + 7) % 7;
  return { label: `${days}d`, sub: "until wildcard" };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("family_members")
    .select("id, family_id, role, name")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const { data: family } = await supabase
    .from("families")
    .select("id, name, invite_code")
    .eq("id", membership.family_id)
    .single();
  if (!family) redirect("/onboarding");

  const { data: members } = await supabase
    .from("family_members")
    .select("id, name, role, dietary_restrictions")
    .eq("family_id", family.id)
    .order("joined_at");

  // ── Streak: all vote dates for current member ──────────────────────────────
  const { data: myVoteRows } = await supabase
    .from("votes")
    .select("created_at")
    .eq("member_id", membership.id);

  const voteDateSet = new Set<number>(
    (myVoteRows ?? []).map((v) => {
      const d = new Date(v.created_at);
      d.setUTCHours(0, 0, 0, 0);
      return d.getTime();
    })
  );
  const streak = computeStreak(voteDateSet);

  // ── Weekly leaderboard ─────────────────────────────────────────────────────
  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("family_id", family.id)
    .eq("week_start_date", currentWeekStart())
    .maybeSingle();

  let voteCounts: Record<string, number> = {};
  if (plan) {
    const { data: slots } = await supabase
      .from("meal_plan_slots")
      .select("id")
      .eq("meal_plan_id", plan.id);

    const slotIds = (slots ?? []).map((s) => s.id);
    if (slotIds.length > 0) {
      const { data: weekVotes } = await supabase
        .from("votes")
        .select("member_id")
        .in("meal_plan_slot_id", slotIds);

      for (const v of weekVotes ?? []) {
        voteCounts[v.member_id] = (voteCounts[v.member_id] ?? 0) + 1;
      }
    }
  }

  // Top voter this week
  const topVoterEntry = Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0];
  const topVoterName = topVoterEntry
    ? (members?.find((m) => m.id === topVoterEntry[0])?.name ?? "—")
    : "—";

  // Ranked leaderboard
  const ranked = (members ?? [])
    .map((m) => ({ ...m, votes: voteCounts[m.id] ?? 0 }))
    .sort((a, b) => b.votes - a.votes);

  const wc = wildcardLabel();

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* Gamification row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-flame rounded-[12px] p-3 text-center">
            <p className="text-2xl mb-1">🔥</p>
            <p className="text-xl font-display font-medium text-white leading-tight">{streak}</p>
            <p className="text-[10px] uppercase text-white/80 tracking-wide font-medium mt-0.5">day streak</p>
          </div>
          <div className="bg-herb rounded-[12px] p-3 text-center overflow-hidden">
            <p className="text-2xl mb-1">👑</p>
            <p className="text-sm font-display font-medium text-white leading-tight truncate px-1">
              {topVoterName}
            </p>
            <p className="text-[10px] uppercase text-white/80 tracking-wide font-medium mt-0.5">top voter</p>
          </div>
          <div className="bg-turmeric rounded-[12px] p-3 text-center">
            <p className="text-2xl mb-1">🎲</p>
            <p className="text-sm font-display font-medium text-white leading-tight">{wc.label}</p>
            <p className="text-[10px] uppercase text-white/80 tracking-wide font-medium mt-0.5">{wc.sub}</p>
          </div>
        </div>

        {/* Family card */}
        <div className="bg-white rounded-[14px] border border-cream-border p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate uppercase tracking-wide mb-1">Your family</p>
              <h1 className="text-2xl font-display font-medium text-charcoal">{family.name}</h1>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-medium text-slate uppercase tracking-wide mb-1">Invite code</p>
              <CopyCode code={family.invite_code} />
            </div>
          </div>
        </div>

        {/* Weekly leaderboard */}
        <div className="bg-white rounded-[14px] border border-cream-border p-5">
          <h2 className="text-xs font-semibold text-slate uppercase tracking-wide mb-4">
            This week's voters
          </h2>
          {ranked.every((m) => m.votes === 0) ? (
            <p className="text-sm text-slate text-center py-2">
              No votes cast yet — go pick your meals!
            </p>
          ) : (
            <ul className="space-y-2">
              {ranked.map((m, i) => {
                const isMe = m.id === membership.id;
                const pct = ranked[0].votes > 0 ? (m.votes / ranked[0].votes) * 100 : 0;
                const medals = ["🥇", "🥈", "🥉"];
                return (
                  <li key={m.id} className="flex items-center gap-3">
                    <span className="text-base w-6 text-center shrink-0">
                      {m.votes > 0 ? (medals[i] ?? "") : ""}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-charcoal truncate">
                          {m.name ?? "Unnamed"}
                          {isMe && (
                            <span className="ml-1.5 text-xs text-flame font-normal">you</span>
                          )}
                        </span>
                        <span className="text-xs text-slate ml-2 shrink-0">
                          {m.votes} vote{m.votes !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="h-1.5 bg-cream rounded-full overflow-hidden">
                        <div
                          className="h-full bg-flame rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Members */}
        <div className="bg-white rounded-[14px] border border-cream-border p-6">
          <h2 className="text-xs font-semibold text-slate uppercase tracking-wide mb-4">
            Members ({members?.length ?? 0})
          </h2>
          <ul className="space-y-3">
            {members?.map((m) => {
              const isMe = m.id === membership.id;
              return (
                <li key={m.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-flame flex items-center justify-center text-white font-semibold text-sm shrink-0">
                    {(m.name ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal">
                      {m.name ?? "Unnamed"}
                      {m.role === "admin" && (
                        <span className="ml-2 text-xs text-flame font-normal">admin</span>
                      )}
                    </p>
                    {(m.dietary_restrictions as string[])?.length > 0 && (
                      <p className="text-xs text-slate">
                        {(m.dietary_restrictions as string[]).join(", ")}
                      </p>
                    )}
                  </div>
                  {isMe && (
                    <Link
                      href="/profile"
                      className="shrink-0 text-xs text-flame hover:text-flame-dark font-medium transition-colors"
                    >
                      Edit
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/recipes" className="bg-white rounded-[14px] border border-cream-border p-5 hover:border-flame transition-colors">
            <p className="text-2xl mb-2">🍳</p>
            <p className="text-sm font-semibold text-charcoal">Recipes</p>
            <p className="text-xs text-slate mt-0.5">Browse &amp; save recipes</p>
          </Link>
          <Link href="/meal-plan" className="bg-white rounded-[14px] border border-cream-border p-5 hover:border-flame transition-colors">
            <p className="text-2xl mb-2">📅</p>
            <p className="text-sm font-semibold text-charcoal">Meal plan</p>
            <p className="text-xs text-slate mt-0.5">Vote on this week</p>
          </Link>
          <Link href="/shopping-list" className="col-span-2 bg-white rounded-[14px] border border-cream-border p-5 hover:border-flame transition-colors">
            <p className="text-2xl mb-2">🛒</p>
            <p className="text-sm font-semibold text-charcoal">Shopping list</p>
            <p className="text-xs text-slate mt-0.5">Ingredients with SA store links</p>
          </Link>
        </div>

      </div>
    </main>
  );
}
