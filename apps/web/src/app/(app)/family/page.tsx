import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CountryForm } from "./CountryForm";
import { FamilyNameForm } from "./FamilyNameForm";
import { CoursePreferencesForm } from "./CoursePreferencesForm";
import { StorePreferencesForm } from "./StorePreferencesForm";
import { getStoresByCountry } from "../shopping-list/storeUtils";
import { COURSE_LABELS, type Course } from "@nomnate/types";

export default async function FamilySettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id, role, name, families(name, invite_code, country, created_at, preferred_stores, courses)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const family = membership.families as {
    name: string;
    invite_code: string | null;
    country: string;
    created_at: string;
    preferred_stores: string[];
    courses: string[];
  } | null;

  const memberCount = await supabase
    .from("family_members")
    .select("id", { count: "exact", head: true })
    .eq("family_id", membership.family_id)
    .then((r) => r.count ?? 0);

  const isAdmin = membership.role === "admin";
  const countryStores = getStoresByCountry(family?.country ?? "ZA").map((s) => ({
    key: s.key,
    label: s.label,
  }));

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 py-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-slate hover:text-charcoal transition-colors mb-3"
        >
          ← Home
        </Link>
        <h1 className="text-2xl font-display font-medium text-flame">Family settings</h1>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-8 space-y-4">
        {/* Family info */}
        <div className="bg-white rounded-[14px] border border-cream-border p-6 space-y-3">
          <p className="text-xs font-semibold text-slate uppercase tracking-wide">Your family</p>
          <div className="flex items-center justify-between">
            <div>
              {isAdmin ? (
                <FamilyNameForm currentName={family?.name ?? ""} />
              ) : (
                <p className="text-base font-semibold text-charcoal">{family?.name ?? "—"}</p>
              )}
              <p className="text-xs text-slate mt-0.5">{memberCount} member{memberCount !== 1 ? "s" : ""}</p>
            </div>
            {family?.invite_code && (
              <div className="text-right">
                <p className="text-xs text-slate mb-0.5">Invite code</p>
                <p className="font-mono text-sm font-bold text-charcoal tracking-widest">{family.invite_code}</p>
              </div>
            )}
          </div>
        </div>

        {/* Country / shopping region */}
        <div className="bg-white rounded-[14px] border border-cream-border p-6 space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-1">Shopping region</p>
            <p className="text-xs text-slate">
              Sets which supermarkets appear in your shopping list.
              {!isAdmin && " Only the family admin can change this."}
            </p>
          </div>
          {isAdmin ? (
            <CountryForm currentCountry={family?.country ?? "ZA"} />
          ) : (
            <p className="text-sm font-medium text-charcoal">
              {family?.country === "GB" ? "🇬🇧 United Kingdom" : family?.country === "FR" ? "🇫🇷 France" : family?.country === "AU" ? "🇦🇺 Australia" : family?.country === "AE" ? "🇦🇪 UAE" : "🇿🇦 South Africa"}
            </p>
          )}
        </div>

        {/* Meal courses */}
        <div className="bg-white rounded-[14px] border border-cream-border p-6 space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-1">Meal courses</p>
            <p className="text-xs text-slate">
              The default courses planned for each day. You can still add a starter or dessert to individual days in the meal plan.
              {!isAdmin && " Only the family admin can change this."}
            </p>
          </div>
          {isAdmin ? (
            <CoursePreferencesForm current={family?.courses ?? ["main"]} />
          ) : (
            <div className="flex flex-wrap gap-2">
              {(family?.courses?.length ? family.courses : ["main"]).map((c) => (
                <span
                  key={c}
                  className="px-3 py-1 rounded-full text-xs font-semibold border border-cream-border text-slate bg-white"
                >
                  {COURSE_LABELS[c as Course] ?? c}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Preferred stores */}
        <div className="bg-white rounded-[14px] border border-cream-border p-6 space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-1">Preferred stores</p>
            <p className="text-xs text-slate">
              Only selected stores will appear in your shopping list.
              {!isAdmin && " Only the family admin can change this."}
            </p>
          </div>
          {isAdmin ? (
            <StorePreferencesForm
              stores={countryStores}
              currentPreferred={family?.preferred_stores ?? []}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {(family?.preferred_stores?.length
                ? countryStores.filter((s) => family.preferred_stores.includes(s.key))
                : countryStores
              ).map((s) => (
                <span
                  key={s.key}
                  className="px-3 py-1 rounded-full text-xs font-semibold border border-cream-border text-slate bg-white"
                >
                  {s.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
