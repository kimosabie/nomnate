import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentWeekStart } from "../meal-plan/utils";
import { assignStore, STORES, type StoreKey } from "./storeUtils";
import { toggleItem, setStore } from "./actions";

const VALID_STORES = new Set(["woolworths", "pnp", "checkers"]);

function effectiveStore(store: string | null, name: string): StoreKey {
  if (store && VALID_STORES.has(store)) return store as StoreKey;
  return assignStore(name);
}

export default async function ShoppingListPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const { store: storeParam } = await searchParams;
  const selectedStore: StoreKey | "all" =
    storeParam && VALID_STORES.has(storeParam) ? (storeParam as StoreKey) : "all";

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

  const storeCounts = Object.fromEntries(
    STORES.map((s) => [
      s.key,
      items.filter((i) => !i.checked && i.effectiveStore === s.key).length,
    ])
  ) as Record<StoreKey, number>;

  const totalUnchecked = items.filter((i) => !i.checked).length;

  const displayed =
    selectedStore === "all"
      ? items
      : items.filter((i) => i.effectiveStore === selectedStore);

  const uncheckedInView = displayed.filter((i) => !i.checked);

  const generatedAt = shoppingList?.generated_at
    ? new Date(shoppingList.generated_at).toLocaleString("en-ZA", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      })
    : null;

  // WhatsApp share text (built server-side — plain link, no JS needed)
  const storeLabel =
    selectedStore === "all"
      ? "Full list"
      : STORES.find((s) => s.key === selectedStore)?.label ?? selectedStore;
  const waLines = uncheckedInView
    .map((i) => {
      const qty = [i.quantity != null ? String(i.quantity) : "", i.unit]
        .filter(Boolean)
        .join(" ");
      return `• ${i.ingredient_name}${qty ? ` — ${qty}` : ""}`;
    })
    .join("\n");
  const waText = `🍽️ *NomNate Shopping List*\n🛒 *${storeLabel}*\n─────────────────────\n${waLines}\n\n_Shared from NomNate_`;

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 py-4">
        <h1 className="text-2xl font-display font-medium text-flame mb-1">Shopping list</h1>
        {generatedAt && <p className="text-xs text-slate">Updated {generatedAt}</p>}
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-8 space-y-4">
        {!shoppingList ? (
          <div className="bg-white rounded-[14px] border border-cream-border p-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-[14px] bg-flame-light flex items-center justify-center text-3xl">🛒</div>
            <div>
              <p className="text-base font-semibold text-charcoal mb-1">No shopping list yet</p>
              <p className="text-sm text-slate">
                Generate one from your{" "}
                <Link href="/meal-plan" className="text-flame hover:underline">meal plan</Link>.
              </p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-[14px] border border-cream-border p-8 text-center">
            <p className="text-sm text-slate">
              No ingredients found — your recipes may not have ingredients saved yet.
            </p>
          </div>
        ) : (
          <>
            {/* Summary row */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate">
                {totalUnchecked} item{totalUnchecked !== 1 ? "s" : ""} to buy
                {items.some((i) => i.checked) &&
                  ` · ${items.filter((i) => i.checked).length} done`}
              </p>
              <Link href="/meal-plan" className="text-xs text-flame hover:underline font-medium">
                Regenerate ↗
              </Link>
            </div>

            {/* Store filter — plain links, no JS */}
            <div className="bg-white rounded-[14px] border border-cream-border px-4 py-3">
              <p className="text-[11px] text-slate font-semibold uppercase tracking-wide mb-2">
                Shop by store
              </p>
              <div className="flex gap-2 flex-wrap">
                {[
                  { key: "all" as const, label: `All (${totalUnchecked})`, href: "?" },
                  ...STORES.map((s) => ({
                    key: s.key,
                    label: `${s.label} (${storeCounts[s.key] ?? 0})`,
                    href: `?store=${s.key}`,
                  })),
                ].map(({ key, label, href }) => {
                  const active = selectedStore === key;
                  return (
                    <Link
                      key={key}
                      href={href}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                      style={{
                        borderColor: active ? "#E8621A" : "#F5D5C0",
                        background: active ? "#E8621A" : "#fff",
                        color: active ? "#fff" : "#777",
                      }}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* WhatsApp share — plain link */}
            {uncheckedInView.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(waText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-[#25D366] text-[#25D366] bg-white"
                >
                  💬 Share on WhatsApp
                </a>
              </div>
            )}

            {/* Item list */}
            <div className="bg-white rounded-[14px] border border-cream-border overflow-hidden">
              {displayed.length === 0 ? (
                <p className="text-sm text-slate text-center py-8">No items for this store.</p>
              ) : (
                <ul className="divide-y divide-cream-border">
                  {displayed.map((item) => {
                    const store = STORES.find((s) => s.key === item.effectiveStore) ?? STORES[2];
                    const qty = [
                      item.quantity != null ? String(item.quantity) : "",
                      item.unit,
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 px-4 py-3"
                        style={{ opacity: item.checked ? 0.4 : 1 }}
                      >
                        {/* Checkbox form */}
                        <form action={toggleItem} className="flex-shrink-0">
                          <input type="hidden" name="itemId" value={item.id} />
                          <input type="hidden" name="checked" value={String(!item.checked)} />
                          <button
                            type="submit"
                            className="w-5 h-5 rounded-[5px] flex items-center justify-center border-2 transition-colors"
                            style={{
                              borderColor: item.checked ? "#E8621A" : "#F5D5C0",
                              background: item.checked ? "#E8621A" : "#fff",
                            }}
                            aria-label={item.checked ? "Uncheck" : "Mark as got"}
                          >
                            {item.checked && (
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path
                                  d="M1.5 5l2.5 2.5 4.5-4.5"
                                  stroke="#fff"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </button>
                        </form>

                        {/* Name */}
                        <span
                          className="flex-1 text-sm font-medium"
                          style={{
                            color: item.checked ? "#bbb" : "#1A1A1A",
                            textDecoration: item.checked ? "line-through" : "none",
                          }}
                        >
                          {item.ingredient_name}
                        </span>

                        {/* Qty */}
                        {qty && (
                          <span className="text-xs text-slate flex-shrink-0">{qty}</span>
                        )}

                        {/* Store picker */}
                        <form action={setStore} className="flex-shrink-0 flex items-center gap-1">
                          <input type="hidden" name="itemId" value={item.id} />
                          <select
                            name="store"
                            defaultValue={item.effectiveStore}
                            className="text-[10px] font-semibold rounded-full pl-2 pr-1 py-0.5 border border-cream-border bg-white text-slate appearance-none cursor-pointer"
                          >
                            {STORES.map((s) => (
                              <option key={s.key} value={s.key}>{s.label}</option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="w-5 h-5 rounded-full bg-flame-light text-flame flex items-center justify-center flex-shrink-0"
                            aria-label="Save store"
                          >
                            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                              <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </form>

                        {/* Search link */}
                        <a
                          href={store.searchUrl(item.ingredient_name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 text-slate hover:text-flame transition-colors"
                          aria-label={`Search at ${store.label}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}

              {displayed.length > 0 && uncheckedInView.length === 0 && (
                <div className="p-5 text-center border-t border-cream-border">
                  <p className="text-xl mb-0.5">✅</p>
                  <p className="text-xs font-semibold text-charcoal">
                    {selectedStore === "all"
                      ? "All done — great shop!"
                      : `Done at ${storeLabel}!`}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
