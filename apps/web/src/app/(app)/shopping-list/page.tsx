import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentWeekStart } from "../meal-plan/utils";
import { ShoppingListClient } from "./ShoppingListClient";

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
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate">
                {items.filter((i) => !i.checked).length} item
                {items.filter((i) => !i.checked).length !== 1 ? "s" : ""} to buy
                {items.some((i) => i.checked) && ` · ${items.filter((i) => i.checked).length} done`}
              </p>
              <Link href="/meal-plan" className="text-xs text-flame hover:underline font-medium">
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
