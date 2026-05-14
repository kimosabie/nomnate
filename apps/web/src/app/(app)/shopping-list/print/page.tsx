import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentWeekStart } from "../../meal-plan/utils";
import { assignStore, getStoresByCountry, type StoreConfig, type StoreKey } from "../storeUtils";
import { PrintButton } from "./PrintButton";

export default async function PrintPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id, families(country, preferred_stores)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const familyData = membership.families as { country?: string; preferred_stores?: string[] } | null;
  const country = familyData?.country ?? "ZA";
  const allStores: StoreConfig[] = getStoresByCountry(country);
  const preferredKeys: string[] = familyData?.preferred_stores ?? [];
  const filtered = preferredKeys.length > 0 ? allStores.filter((s) => preferredKeys.includes(s.key)) : [];
  const STORES: StoreConfig[] = filtered.length > 0 ? filtered : allStores;
  const VALID_STORES = new Set(STORES.map((s) => s.key));

  function effectiveStore(store: string | null, name: string): StoreKey {
    if (store && VALID_STORES.has(store)) return store as StoreKey;
    const natural = assignStore(name, country);
    if (VALID_STORES.has(natural)) return natural as StoreKey;
    return [...VALID_STORES][0] as StoreKey ?? natural;
  }

  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("family_id", membership.family_id)
    .eq("week_start_date", currentWeekStart())
    .maybeSingle();

  const shoppingList = plan
    ? await supabase
        .from("shopping_lists")
        .select("id, generated_at")
        .eq("meal_plan_id", plan.id)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then((r) => r.data)
    : null;

  const rawItems = shoppingList
    ? await supabase
        .from("shopping_list_items")
        .select("id, ingredient_name, quantity, unit, checked, store")
        .eq("list_id", shoppingList.id)
        .order("ingredient_name")
        .then((r) => r.data ?? [])
    : [];

  const items = rawItems.map((i) => ({
    ...i,
    effectiveStore: effectiveStore(i.store, i.ingredient_name),
  }));

  const byStore = STORES.map((s) => ({
    store: s,
    items: items.filter((i) => i.effectiveStore === s.key),
  })).filter((g) => g.items.length > 0);

  const LOCALE_MAP: Record<string, string> = { ZA: "en-ZA", GB: "en-GB", UK: "en-GB", FR: "fr-FR", AU: "en-AU", AE: "en-AE" };
  const weekLabel = new Date(currentWeekStart()).toLocaleDateString(LOCALE_MAP[country] ?? "en-ZA", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      {/* Screen-only controls */}
      <div className="print:hidden flex items-center justify-between mb-6">
        <Link href="/shopping-list" className="text-sm text-slate hover:text-flame transition-colors">
          ← Back
        </Link>
        <PrintButton />
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-display font-medium text-flame">NomNate Shopping List</h1>
        <p className="text-sm text-slate mt-0.5">Week of {weekLabel}</p>
      </div>

      {!shoppingList || items.length === 0 ? (
        <p className="text-sm text-slate">No shopping list for this week.</p>
      ) : (
        <div className="space-y-7">
          {byStore.map(({ store, items: storeItems }) => (
            <section key={store.key}>
              <h2 className="text-sm font-semibold text-charcoal uppercase tracking-wide border-b border-cream-border pb-1.5 mb-3">
                {store.label}
              </h2>
              <ul className="space-y-2.5">
                {storeItems.map((item) => {
                  const qty = [item.quantity != null ? String(item.quantity) : "", item.unit]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <li key={item.id} className="flex items-start gap-3">
                      <span className="mt-0.5 w-4 h-4 border-2 border-slate rounded-sm flex-shrink-0" />
                      <span
                        className="text-sm flex-1"
                        style={{
                          color: item.checked ? "#aaa" : "#1A1A1A",
                          textDecoration: item.checked ? "line-through" : "none",
                        }}
                      >
                        {item.ingredient_name}
                      </span>
                      {qty && (
                        <span className="text-xs text-slate flex-shrink-0">{qty}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="hidden print:block text-[10px] text-slate mt-10 pt-3 border-t border-gray-200">
        Printed from NomNate
      </p>
    </main>
  );
}
