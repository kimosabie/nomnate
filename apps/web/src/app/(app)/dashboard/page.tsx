import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../../(auth)/actions";
import { CopyCode } from "./CopyCode";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id, role, name")
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

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-orange-500">NomNate</span>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        {/* Family card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                Your family
              </p>
              <h1 className="text-2xl font-bold text-gray-900">{family.name}</h1>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                Invite code
              </p>
              <CopyCode code={family.invite_code} />
            </div>
          </div>
        </div>

        {/* Members */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Members ({members?.length ?? 0})
          </h2>
          <ul className="space-y-3">
            {members?.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-semibold text-sm shrink-0">
                  {(m.name ?? "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {m.name ?? "Unnamed"}
                    {m.role === "admin" && (
                      <span className="ml-2 text-xs text-orange-500 font-normal">
                        admin
                      </span>
                    )}
                  </p>
                  {m.dietary_restrictions?.length > 0 && (
                    <p className="text-xs text-gray-400">
                      {m.dietary_restrictions.join(", ")}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Meal plan CTA */}
        <div className="bg-orange-500 rounded-2xl p-6 text-white">
          <p className="text-sm font-medium opacity-80 mb-1">This week</p>
          <h2 className="text-xl font-bold mb-4">Ready to plan your meals?</h2>
          <button
            disabled
            className="bg-white text-orange-500 font-semibold text-sm px-5 py-2.5 rounded-lg opacity-70 cursor-not-allowed"
          >
            Coming soon — meal planning
          </button>
        </div>
      </div>
    </main>
  );
}
