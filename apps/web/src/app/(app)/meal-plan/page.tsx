import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WeeklyCalendar } from "./WeeklyCalendar";
import type { SlotData, VoteData } from "./WeeklyCalendar";
import { GeneratePlanButton } from "./GeneratePlanButton";
import { GenerateShoppingListButton } from "./GenerateShoppingListButton";
import { currentWeekStart } from "./utils";

export default async function MealPlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("family_members")
    .select("id, family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const weekStart = currentWeekStart();

  // Format "Mon 4 May – Sun 10 May" for the header
  function fmtWeekRange(ws: string): string {
    const mon = new Date(ws + "T00:00:00");
    const sun = new Date(ws + "T00:00:00");
    sun.setDate(sun.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
    return `${mon.toLocaleDateString("en-ZA", opts)} – ${sun.toLocaleDateString("en-ZA", opts)}`;
  }

  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("family_id", membership.family_id)
    .eq("week_start_date", weekStart)
    .maybeSingle();

  if (!plan) {
    const { count: savedCount } = await supabase
      .from("recipes")
      .select("id", { count: "exact", head: true })
      .eq("family_id", membership.family_id);

    const count = savedCount ?? 0;

    return (
      <main className="min-h-screen bg-gray-50">
        <PageHeader weekRange={fmtWeekRange(weekStart)} />
        <div className="max-w-3xl mx-auto px-6 py-16 flex flex-col items-center text-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center text-3xl">
            &#128197;
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              No plan for this week yet
            </h2>
            {count === 0 ? (
              <p className="text-sm text-gray-500">
                You need at least one saved recipe before generating a plan.{" "}
                <Link href="/recipes" className="text-orange-500 hover:underline">
                  Add some recipes first.
                </Link>
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                {count} recipe{count !== 1 ? "s" : ""} saved —{" "}
                {count < 7
                  ? `${7 - count} day${7 - count !== 1 ? "s" : ""} will have no recipe assigned`
                  : "enough to fill the whole week"}.
              </p>
            )}
          </div>
          {count > 0 && <GeneratePlanButton />}
        </div>
      </main>
    );
  }

  // Check if a shopping list exists for this plan
  const { data: existingList } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("meal_plan_id", plan.id)
    .limit(1)
    .maybeSingle();

  // Load slots
  const { data: rawSlots } = await supabase
    .from("meal_plan_slots")
    .select("id, day_of_week, status, recipe_id")
    .eq("meal_plan_id", plan.id)
    .order("day_of_week");

  const slots = rawSlots ?? [];
  const slotIds = slots.map((s) => s.id);
  const recipeIds = [...new Set(slots.map((s) => s.recipe_id).filter(Boolean))] as string[];

  // Parallel fetch recipes + votes
  const [{ data: recipes }, { data: rawVotes }] = await Promise.all([
    recipeIds.length > 0
      ? supabase
          .from("recipes")
          .select("id, title, image_url, prep_time, cuisine")
          .in("id", recipeIds)
      : Promise.resolve({ data: [] }),
    slotIds.length > 0
      ? supabase
          .from("votes")
          .select("id, meal_plan_slot_id, member_id, value")
          .in("meal_plan_slot_id", slotIds)
      : Promise.resolve({ data: [] }),
  ]);

  const recipeMap = new Map((recipes ?? []).map((r) => [r.id, r]));

  const slotsData: SlotData[] = slots.map((s) => ({
    id: s.id,
    day_of_week: s.day_of_week,
    status: s.status as SlotData["status"],
    recipe: s.recipe_id ? (recipeMap.get(s.recipe_id) ?? null) : null,
  }));

  const votes: VoteData[] = (rawVotes ?? []).map((v) => ({
    id: v.id,
    meal_plan_slot_id: v.meal_plan_slot_id,
    member_id: v.member_id,
    value: v.value as VoteData["value"],
  }));

  return (
    <main className="min-h-screen bg-gray-50">
      <PageHeader weekRange={fmtWeekRange(weekStart)} />
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        <WeeklyCalendar
          slots={slotsData}
          initialVotes={votes}
          memberId={membership.id}
          weekStart={weekStart}
        />

        {/* Shopping list */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Shopping list</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {existingList
                  ? "Last generated — tap to regenerate or view"
                  : "Generate a list from this week's recipes"}
              </p>
            </div>
            {existingList && (
              <Link
                href="/shopping-list"
                className="text-sm font-semibold text-orange-500 hover:text-orange-600 shrink-0"
              >
                View list &#8594;
              </Link>
            )}
          </div>
          <div className="mt-4">
            <GenerateShoppingListButton hasExisting={!!existingList} />
          </div>
        </div>
      </div>
    </main>
  );
}

function PageHeader({ weekRange }: { weekRange: string }) {
  return (
    <header className="bg-white border-b border-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-gray-400 hover:text-gray-700 text-lg leading-none transition-colors"
          aria-label="Back to dashboard"
        >
          &#8592;
        </Link>
        <div>
          <span className="text-xl font-bold text-orange-500">Meal plan</span>
          <span className="ml-2 text-sm text-gray-400">{weekRange}</span>
        </div>
      </div>
    </header>
  );
}
