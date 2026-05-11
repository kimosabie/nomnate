import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const COUNTRY_LABELS: Record<string, string> = {
  ZA: "🇿🇦 South Africa",
  UK: "🇬🇧 United Kingdom",
  FR: "🇫🇷 France",
};

const COUNTRY_SHORT: Record<string, string> = {
  ZA: "🇿🇦 ZA",
  UK: "🇬🇧 UK",
  FR: "🇫🇷 FR",
};

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!process.env.ADMIN_EMAIL || user.email !== process.env.ADMIN_EMAIL) notFound();

  const admin = createAdminClient();

  const [
    { count: familyCount },
    { count: recipeCount },
    { count: voteCount },
    { data: families },
    { data: allMembers },
    { data: mealPlans },
    { data: allFeedback },
    authResult,
    { data: countryRows },
    { data: recipeSources },
  ] = await Promise.all([
    admin.from("families").select("id", { count: "exact", head: true }),
    admin.from("recipes").select("id", { count: "exact", head: true }),
    admin.from("votes").select("id", { count: "exact", head: true }),
    admin.from("families").select("id, name, invite_code, country, created_at").order("created_at", { ascending: false }).limit(50),
    admin.from("family_members").select("id, family_id, user_id, name, role, joined_at"),
    admin.from("meal_plans").select("id, family_id"),
    admin.from("feedback").select("id, user_id, reviewed, type, created_at"),
    admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    admin.from("families").select("country"),
    admin.from("recipes").select("source").then(async (r) => {
      const counts: Record<string, number> = {};
      for (const row of r.data ?? []) counts[row.source] = (counts[row.source] ?? 0) + 1;
      return { data: Object.entries(counts).sort((a, b) => b[1] - a[1]) };
    }),
  ]);

  const authUsers = authResult.data?.users ?? [];
  const memberCount = allMembers?.length ?? 0;

  // Aggregate per-family stats from flat arrays
  const membersByFamily: Record<string, typeof allMembers> = {};
  const lastActivityByFamily: Record<string, string> = {};
  for (const m of allMembers ?? []) {
    if (!membersByFamily[m.family_id]) membersByFamily[m.family_id] = [];
    membersByFamily[m.family_id]!.push(m);
    if (!lastActivityByFamily[m.family_id] || m.joined_at > lastActivityByFamily[m.family_id]) {
      lastActivityByFamily[m.family_id] = m.joined_at;
    }
  }

  const mealPlansByFamily: Record<string, number> = {};
  for (const mp of mealPlans ?? []) mealPlansByFamily[mp.family_id] = (mealPlansByFamily[mp.family_id] ?? 0) + 1;

  // Map user_id → family_id for feedback lookup
  const familyByUser: Record<string, string> = {};
  for (const m of allMembers ?? []) familyByUser[m.user_id] = m.family_id;

  const feedbackByFamily: Record<string, number> = {};
  for (const fb of allFeedback ?? []) {
    const fid = familyByUser[fb.user_id];
    if (fid) feedbackByFamily[fid] = (feedbackByFamily[fid] ?? 0) + 1;
  }

  // Country breakdown
  const countryCounts: Record<string, number> = {};
  for (const row of countryRows ?? []) {
    const c = row.country ?? "ZA";
    countryCounts[c] = (countryCounts[c] ?? 0) + 1;
  }
  const countryBreakdown = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);
  const totalFamilies = familyCount ?? 1;

  // Feedback summary
  const feedbackCounts = { total: 0, unreviewed: 0, bug: 0, idea: 0, feedback: 0 };
  for (const fb of allFeedback ?? []) {
    feedbackCounts.total++;
    if (!fb.reviewed) feedbackCounts.unreviewed++;
    const t = fb.type as keyof typeof feedbackCounts;
    if (t in feedbackCounts) (feedbackCounts[t] as number)++;
  }

  // Build auth users lookup
  const authUserMap: Record<string, { email: string; last_sign_in_at: string | null }> = {};
  for (const u of authUsers) {
    authUserMap[u.id] = { email: u.email ?? "—", last_sign_in_at: u.last_sign_in_at ?? null };
  }

  const stats = [
    { label: "Families", value: familyCount ?? 0, emoji: "👨‍👩‍👧‍👦" },
    { label: "Accounts", value: memberCount, emoji: "👤" },
    { label: "Recipes", value: recipeCount ?? 0, emoji: "🍽️" },
    { label: "Votes", value: voteCount ?? 0, emoji: "🗳️" },
  ];

  return (
    <main className="min-h-screen bg-[#0f0f0f] text-white">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display font-semibold text-white">Admin dashboard</h1>
            <p className="text-xs text-white/40 mt-0.5">{user.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin/feedback" className="text-xs text-white/40 hover:text-white transition-colors">
              Feedback →
            </Link>
            <Link href="/dashboard" className="text-xs text-white/40 hover:text-white transition-colors">
              ← App
            </Link>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {stats.map((s) => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-2xl mb-1">{s.emoji}</p>
              <p className="text-3xl font-bold text-[#E8621A]">{s.value.toLocaleString()}</p>
              <p className="text-xs text-white/50 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Country breakdown */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-3">
              Families by country
            </p>
            <div className="space-y-3">
              {countryBreakdown.map(([code, count]) => (
                <div key={code}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/70">{COUNTRY_LABELS[code] ?? code}</span>
                    <span className="text-xs text-white/50">{count}</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#E8621A] rounded-full"
                      style={{ width: `${Math.round((count / totalFamilies) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recipe sources */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-3">
              Recipes by source
            </p>
            <div className="space-y-1.5">
              {(recipeSources ?? []).map(([source, count]) => (
                <div key={source} className="flex items-center justify-between">
                  <span className="text-sm text-white">{source}</span>
                  <span className="text-xs font-semibold text-white/60 bg-white/10 px-2 py-0.5 rounded-full">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Feedback summary */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-3">
              Feedback
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">Total</span>
                <span className="text-sm font-bold text-white">{feedbackCounts.total}</span>
              </div>
              {feedbackCounts.unreviewed > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#E8621A]">Unreviewed</span>
                  <span className="text-xs font-bold bg-[#E8621A] text-white px-2 py-0.5 rounded-full">
                    {feedbackCounts.unreviewed}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">🐛 Bugs</span>
                <span className="text-xs text-white/50">{feedbackCounts.bug}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">💡 Ideas</span>
                <span className="text-xs text-white/50">{feedbackCounts.idea}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">💬 Feedback</span>
                <span className="text-xs text-white/50">{feedbackCounts.feedback}</span>
              </div>
              <Link
                href="/admin/feedback"
                className="block text-xs text-[#E8621A] hover:text-[#ff8040] transition-colors mt-1"
              >
                View all feedback →
              </Link>
            </div>
          </div>
        </div>

        {/* Families table */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">
              Families ({familyCount ?? 0})
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-xs text-white/40 font-medium">Family</th>
                  <th className="text-left px-4 py-2 text-xs text-white/40 font-medium">Country</th>
                  <th className="text-right px-4 py-2 text-xs text-white/40 font-medium">Members</th>
                  <th className="text-right px-4 py-2 text-xs text-white/40 font-medium">Plans</th>
                  <th className="text-right px-4 py-2 text-xs text-white/40 font-medium">Feedback</th>
                  <th className="text-left px-4 py-2 text-xs text-white/40 font-medium">Joined</th>
                  <th className="text-left px-4 py-2 text-xs text-white/40 font-medium">Activity</th>
                </tr>
              </thead>
              <tbody>
                {(families ?? []).map((f) => {
                  const members = membersByFamily[f.id] ?? [];
                  const plans = mealPlansByFamily[f.id] ?? 0;
                  const fbCount = feedbackByFamily[f.id] ?? 0;
                  return (
                    <tr key={f.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-2.5">
                        <div>
                          <span className="text-white font-medium">{f.name}</span>
                          <span className="text-white/30 text-xs font-mono ml-2">{f.invite_code}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-white/60 text-xs whitespace-nowrap">
                        {COUNTRY_SHORT[f.country] ?? f.country ?? "🇿🇦 ZA"}
                      </td>
                      <td className="px-4 py-2.5 text-white/60 text-right">{members.length}</td>
                      <td className="px-4 py-2.5 text-white/60 text-right">{plans}</td>
                      <td className="px-4 py-2.5 text-right">
                        {fbCount > 0 ? (
                          <span className="text-xs text-[#E8621A]">{fbCount}</span>
                        ) : (
                          <span className="text-white/30 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-white/40 whitespace-nowrap">
                        {new Date(f.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-white/40 whitespace-nowrap">
                        {relativeTime(lastActivityByFamily[f.id] ?? null)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Accounts table */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">
              Accounts ({memberCount} members · {authUsers.length} auth users)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-2 text-xs text-white/40 font-medium">Name</th>
                  <th className="text-left px-4 py-2 text-xs text-white/40 font-medium">Email</th>
                  <th className="text-left px-4 py-2 text-xs text-white/40 font-medium">Family</th>
                  <th className="text-left px-4 py-2 text-xs text-white/40 font-medium">Role</th>
                  <th className="text-left px-4 py-2 text-xs text-white/40 font-medium">Joined</th>
                  <th className="text-left px-4 py-2 text-xs text-white/40 font-medium">Last active</th>
                </tr>
              </thead>
              <tbody>
                {(allMembers ?? [])
                  .sort((a, b) => b.joined_at.localeCompare(a.joined_at))
                  .slice(0, 50)
                  .map((m) => {
                    const auth = authUserMap[m.user_id];
                    const family = (families ?? []).find((f) => f.id === m.family_id);
                    const neverLoggedIn = auth && !auth.last_sign_in_at;
                    return (
                      <tr key={m.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-2.5 text-white font-medium">{m.name ?? "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-white/50">{auth?.email ?? "—"}</td>
                        <td className="px-4 py-2.5 text-white/60 text-xs">{family?.name ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            m.role === "admin" ? "bg-[#E8621A]/20 text-[#E8621A]" : "bg-white/10 text-white/50"
                          }`}>
                            {m.role}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-white/40 whitespace-nowrap">
                          {new Date(m.joined_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                        </td>
                        <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                          {neverLoggedIn ? (
                            <span className="text-[#E8621A]">Never logged in</span>
                          ) : (
                            <span className="text-white/40">{relativeTime(auth?.last_sign_in_at ?? null)}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
