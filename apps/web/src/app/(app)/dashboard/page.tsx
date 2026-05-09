import Link from "next/link";
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

  return (
    <main className="min-h-screen bg-cream">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-semibold text-flame">NomNate</span>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-slate hover:text-charcoal transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        {/* Family card */}
        <div className="bg-white rounded-[14px] border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate uppercase tracking-wide mb-1">
                Your family
              </p>
              <h1 className="text-2xl font-semibold text-charcoal">{family.name}</h1>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-medium text-slate uppercase tracking-wide mb-1">
                Invite code
              </p>
              <CopyCode code={family.invite_code} />
            </div>
          </div>
        </div>

        {/* Members */}
        <div className="bg-white rounded-[14px] border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-slate uppercase tracking-wide mb-4">
            Members ({members?.length ?? 0})
          </h2>
          <ul className="space-y-3">
            {members?.map((m) => {
              const isMe = m.id === membership.id;
              return (
                <li key={m.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-flame-light flex items-center justify-center text-flame-dark font-semibold text-sm shrink-0">
                    {(m.name ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal">
                      {m.name ?? "Unnamed"}
                      {m.role === "admin" && (
                        <span className="ml-2 text-xs text-flame font-normal">
                          admin
                        </span>
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
          <Link
            href="/recipes"
            className="bg-white rounded-[14px] border border-gray-200 p-5 hover:border-flame-light transition-colors"
          >
            <p className="text-2xl mb-2">&#127859;</p>
            <p className="text-sm font-semibold text-charcoal">Recipes</p>
            <p className="text-xs text-slate mt-0.5">Browse &amp; save recipes</p>
          </Link>
          <Link
            href="/meal-plan"
            className="bg-white rounded-[14px] border border-gray-200 p-5 hover:border-flame-light transition-colors"
          >
            <p className="text-2xl mb-2">&#128197;</p>
            <p className="text-sm font-semibold text-charcoal">Meal plan</p>
            <p className="text-xs text-slate mt-0.5">Vote on this week</p>
          </Link>
          <Link
            href="/shopping-list"
            className="col-span-2 bg-white rounded-[14px] border border-gray-200 p-5 hover:border-flame-light transition-colors"
          >
            <p className="text-2xl mb-2">&#128722;</p>
            <p className="text-sm font-semibold text-charcoal">Shopping list</p>
            <p className="text-xs text-slate mt-0.5">Ingredients with SA store links</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
