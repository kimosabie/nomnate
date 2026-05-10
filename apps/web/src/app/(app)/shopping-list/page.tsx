import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentWeekStart } from "../meal-plan/utils";
import { STORES, assignStore } from "./storeUtils";

export default async function ShoppingListPage() {
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
        .select("id, generated_at")
        .eq("meal_plan_id", plan.id)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then((r) => r.data)
    : null;

  const items = shoppingList
    ? await supabase
        .from("shopping_list_items")
        .select("id, ingredient_name, quantity, unit, checked, store")
        .eq("list_id", shoppingList.id)
        .then((r) => r.data ?? [])
    : [];

  const generatedAt = shoppingList?.generated_at
    ? new Date(shoppingList.generated_at).toLocaleString("en-ZA", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  // Compute per-store counts server-side
  const storeCounts = STORES.map((s) => {
    const storeItems = items.filter(
      (i) => (i.store ?? assignStore(i.ingredient_name)) === s.key
    );
    return {
      ...s,
      total: storeItems.length,
      done: storeItems.filter((i) => i.checked).length,
    };
  });

  const totalItems = items.length;
  const totalDone = items.filter((i) => i.checked).length;

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 py-4">
        <h1 className="text-2xl font-display font-medium text-flame mb-1">Shopping list</h1>
        {generatedAt && (
          <p className="text-xs text-slate">Updated {generatedAt}</p>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-8 space-y-4">
        {!shoppingList ? (
          <div className="bg-white rounded-[14px] border border-cream-border p-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-[14px] bg-flame-light flex items-center justify-center text-3xl">
              🛒
            </div>
            <div>
              <p className="text-base font-semibold text-charcoal mb-1">No shopping list yet</p>
              <p className="text-sm text-slate">
                Generate one from your{" "}
                <Link href="/meal-plan" className="text-flame hover:underline">
                  meal plan
                </Link>
                .
              </p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-[14px] border border-cream-border p-8 flex flex-col items-center text-center gap-4">
            <p className="text-sm text-slate">
              No ingredients found — your recipes may not have ingredients saved yet.
            </p>
          </div>
        ) : (
          <>
            {/* Summary row */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate">
                {totalItems - totalDone} item{totalItems - totalDone !== 1 ? "s" : ""} to buy
                {totalDone > 0 && ` · ${totalDone} done`}
              </p>
              <Link href="/meal-plan" className="text-xs text-flame hover:underline font-medium">
                Regenerate ↗
              </Link>
            </div>

            {/* Store cards */}
            {storeCounts.map((s) => (
              <Link
                key={s.key}
                href={`/shopping-list/${s.key}`}
                className="block bg-white rounded-[14px] border border-cream-border p-4 hover:border-flame transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-[10px] flex items-center justify-center text-lg font-bold"
                      style={{ background: s.selectBg }}
                    >
                      🛒
                    </div>
                    <div>
                      <p className="font-semibold text-charcoal text-sm">{s.label}</p>
                      <p className="text-xs text-slate">
                        {s.total - s.done} item{s.total - s.done !== 1 ? "s" : ""} to buy
                        {s.done > 0 && ` · ${s.done} done`}
                      </p>
                    </div>
                  </div>
                  <svg
                    width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="#E8621A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>

                {/* Progress bar */}
                {s.total > 0 && (
                  <div className="mt-3 h-1.5 bg-cream-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round((s.done / s.total) * 100)}%`,
                        background: s.selectBg === "#FDE8E0" ? "#E8621A" : s.selectBg === "#E8F5E9" ? "#2E7D32" : "#185FA5",
                      }}
                    />
                  </div>
                )}
              </Link>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
