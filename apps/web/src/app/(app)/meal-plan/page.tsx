import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WeeklyCalendar } from "./WeeklyCalendar";
import type { SlotData, VoteData } from "./WeeklyCalendar";
import { GeneratePlanButton } from "./GeneratePlanButton";
import { GenerateShoppingListButton } from "./GenerateShoppingListButton";
import { AISuggestButton } from "./AISuggestButton";
import { ResetPlanButton } from "./ResetPlanButton";
import { getAIUsageThisWeek } from "./actions";
import { FREE_AI_LIMIT } from "./constants";
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
    const [{ count: savedCount }, aiUsed] = await Promise.all([
      supabase
        .from("recipes")
        .select("id", { count: "exact", head: true })
        .eq("family_id", membership.family_id),
      getAIUsageThisWeek(membership.family_id),
    ]);

    const count = savedCount ?? 0;
    const aiRemaining = FREE_AI_LIMIT - aiUsed;

    return (
      <main className="min-h-screen bg-cream">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <p className="text-xs text-slate">{fmtWeekRange(weekStart)}</p>
          <h1 className="text-2xl font-display font-medium text-flame mt-1 mb-6">Meal plan</h1>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-12 space-y-6">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-[14px] bg-flame-light flex items-center justify-center text-3xl">
              📅
            </div>
            <div>
              <p className="text-base font-semibold text-charcoal mb-2">
                No plan for this week yet
              </p>
              <p className="text-sm text-slate">
                {count > 0
                  ? `${count} recipe${count !== 1 ? "s" : ""} in your library — or let Claude suggest meals for you.`
                  : "Let Claude suggest meals, or add your own recipes first."}
              </p>
            </div>
          </div>

          <div className="max-w-sm mx-auto w-full space-y-3">
            <AISuggestButton remaining={aiRemaining} variant="primary" />
            {count > 0 && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-cream-border" />
                  <span className="text-xs text-slate">or</span>
                  <div className="flex-1 h-px bg-cream-border" />
                </div>
                <GeneratePlanButton />
              </>
            )}
            {count === 0 && (
              <p className="text-xs text-center text-slate">
                Or{" "}
                <Link href="/recipes" className="text-flame hover:underline">
                  add your own recipes
                </Link>{" "}
                first.
              </p>
            )}
          </div>
        </div>
      </main>
    );
  }

  const [aiUsed, { data: existingList }, { data: rawSlots }, { data: familyRecipes }] =
    await Promise.all([
      getAIUsageThisWeek(membership.family_id),
      supabase
        .from("shopping_lists")
        .select("id")
        .eq("meal_plan_id", plan.id)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("meal_plan_slots")
        .select("id, day_of_week, option_number, status, recipe_id")
        .eq("meal_plan_id", plan.id)
        .order("day_of_week")
        .order("option_number"),
      supabase
        .from("recipes")
        .select("id, title, image_url, prep_time, cuisine")
        .eq("family_id", membership.family_id)
        .order("is_favourite", { ascending: false })
        .order("title"),
    ]);

  const aiRemaining = FREE_AI_LIMIT - aiUsed;

  const slots = rawSlots ?? [];
  const slotIds = slots.map((s) => s.id);
  const recipeIds = [...new Set(slots.map((s) => s.recipe_id).filter(Boolean))] as string[];

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
    option_number: s.option_number,
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
    <main className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 py-4">
        <p className="text-xs text-slate">{fmtWeekRange(weekStart)}</p>
        <div className="flex items-baseline justify-between mt-1 mb-2">
          <h1 className="text-2xl font-display font-medium text-flame">Meal plan</h1>
          <ResetPlanButton />
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 pb-6 space-y-4">
        <WeeklyCalendar
          slots={slotsData}
          initialVotes={votes}
          memberId={membership.id}
          weekStart={weekStart}
          recipes={familyRecipes ?? []}
          aiRemaining={aiRemaining}
        />

        {/* AI suggestions */}
        <div className="bg-white rounded-[14px] border border-cream-border p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-charcoal">Suggest with AI</p>
            <p className="text-xs text-slate mt-0.5">
              Claude will generate new recipes and fill any empty days
            </p>
          </div>
          <AISuggestButton remaining={aiRemaining} variant="secondary" />
        </div>

        {/* Shopping list */}
        <div className="bg-white rounded-[14px] border border-cream-border p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-charcoal">Shopping list</p>
              <p className="text-xs text-slate mt-0.5">
                {existingList
                  ? "Last generated — tap to regenerate or view"
                  : "Generate a list from this week's recipes"}
              </p>
            </div>
            {existingList && (
              <Link
                href="/shopping-list"
                className="text-sm font-semibold text-flame hover:text-flame-dark shrink-0"
              >
                View list →
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
