import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ShoppingListClient } from "./ShoppingListClient";
import { currentWeekStart } from "../meal-plan/utils";

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
        .order("ingredient_name")
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

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/meal-plan"
              className="text-gray-400 hover:text-gray-700 text-lg leading-none transition-colors"
              aria-label="Back to meal plan"
            >
              &#8592;
            </Link>
            <span className="text-xl font-bold text-orange-500">Shopping list</span>
          </div>
          {generatedAt && (
            <span className="text-xs text-gray-400">Updated {generatedAt}</span>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {!shoppingList ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center text-3xl">
              &#128722;
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">No shopping list yet</h2>
              <p className="text-sm text-gray-500">
                Generate one from your{" "}
                <Link href="/meal-plan" className="text-orange-500 hover:underline">
                  meal plan
                </Link>
                .
              </p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-center text-center gap-4">
            <p className="text-sm text-gray-400">
              No ingredients found — your recipes may not have ingredients saved yet.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {items.filter((i) => !i.checked).length} item
                {items.filter((i) => !i.checked).length !== 1 ? "s" : ""} to buy
                {items.some((i) => i.checked) && ` · ${items.filter((i) => i.checked).length} done`}
              </p>
              <Link
                href="/meal-plan"
                className="text-xs text-orange-500 hover:underline font-medium"
              >
                Regenerate ↗
              </Link>
            </div>
            <ShoppingListClient initialItems={items} />
          </>
        )}
      </div>
    </main>
  );
}
