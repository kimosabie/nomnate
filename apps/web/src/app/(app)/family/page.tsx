import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CountryForm } from "./CountryForm";
import { StorePreferencesForm } from "./StorePreferencesForm";
import { getStoresByCountry } from "../shopping-list/storeUtils";

export default async function FamilySettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id, role, name, families(name, invite_code, country, created_at, preferred_stores)")
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
              <p className="text-base font-semibold text-charcoal">{family?.name ?? "—"}</p>
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
              {family?.country === "GB" || family?.country === "UK" ? "🇬🇧 United Kingdom" : family?.country === "FR" ? "🇫🇷 France" : family?.country === "AU" ? "🇦🇺 Australia" : family?.country === "AE" ? "🇦🇪 UAE" : "🇿🇦 South Africa"}
            </p>
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
