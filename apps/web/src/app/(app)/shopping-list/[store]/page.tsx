import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentWeekStart } from "../../meal-plan/utils";
import { STORES, assignStore, StoreKey } from "../storeUtils";
import { StoreListClient } from "./StoreListClient";

const VALID_STORES: StoreKey[] = ["woolworths", "pnp", "checkers"];

export default async function StoreShoppingListPage({
  params,
}: {
  params: Promise<{ store: string }>;
}) {
  const { store } = await params;
  if (!VALID_STORES.includes(store as StoreKey)) notFound();
  const storeKey = store as StoreKey;
  const storeMeta = STORES.find((s) => s.key === storeKey)!;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const weekStart = currentWeekStart();

  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("family_id", membership.family_id)
    .eq("week_start_date", weekStart)
    .maybeSingle();

  const shoppingList = plan
    ? await supabase
        .from("shopping_lists")
        .select("id")
        .eq("meal_plan_id", plan.id)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then((r) => r.data)
    : null;

  const allItems = shoppingList
    ? await supabase
        .from("shopping_list_items")
        .select("id, ingredient_name, quantity, unit, checked, store")
        .eq("list_id", shoppingList.id)
        .order("ingredient_name")
        .then((r) => r.data ?? [])
    : [];

  const items = allItems.filter(
    (i) => (i.store ?? assignStore(i.ingredient_name)) === storeKey
  );

  return (
    <main className="min-h-screen bg-cream">
      {/* Header */}
      <div className="max-w-3xl mx-auto px-4 py-4">
        <a
          href="/shopping-list"
          className="inline-flex items-center gap-1 text-xs text-slate hover:text-flame mb-3"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          All stores
        </a>
        <h1 className="text-2xl font-display font-medium text-flame mb-0.5">
          {storeMeta.label}
        </h1>
        <p className="text-xs text-slate">
          {items.filter((i) => !i.checked).length} item{items.filter((i) => !i.checked).length !== 1 ? "s" : ""} to buy
          {items.some((i) => i.checked) && ` · ${items.filter((i) => i.checked).length} done`}
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-8">
        {items.length === 0 ? (
          <div className="bg-white rounded-[14px] border border-cream-border p-8 text-center">
            <p className="text-sm text-slate">No items for {storeMeta.label} this week.</p>
          </div>
        ) : (
          <StoreListClient
            initialItems={items}
            storeLabel={storeMeta.label}
            storeSearchUrl={storeMeta.searchUrl}
            selectBg={storeMeta.selectBg}
          />
        )}
      </div>
    </main>
  );
}
