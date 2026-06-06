"use client";

import { useMemo, useState, useEffect, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { COURSE_LABELS, type Course } from "@nomnate/types";
import { castVote, removeFromSlot, assignRecipeToSlot, suggestForSlot } from "./actions";

const DAY_NAMES = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

// Render order for course sections within a day
const COURSE_RENDER_ORDER = ["starter", "main", "dessert", "side"] as const;

const VOTE_CONFIG = {
  love: {
    label: "Love", symbol: "♥",
    active:   "bg-flame-light text-flame-dark ring-1 ring-flame",
    inactive: "bg-[#F3F3F3] text-slate hover:bg-flame-light hover:text-flame-dark",
  },
  up: {
    label: "Yes", symbol: "✓",
    active:   "bg-herb-light text-herb ring-1 ring-herb",
    inactive: "bg-[#F3F3F3] text-slate hover:bg-herb-light hover:text-herb",
  },
  down: {
    label: "No", symbol: "✕",
    active:   "bg-[#F3F3F3] text-slate ring-1 ring-slate/40",
    inactive: "bg-[#F3F3F3] text-slate hover:bg-cream-border/40",
  },
} as const;

type VoteValue = "up" | "down" | "love";

export type VoteData = {
  id: string;
  meal_plan_slot_id: string;
  member_id: string;
  value: VoteValue;
};

export type RecipeData = {
  id: string;
  title: string;
  image_url: string | null;
  prep_time: number | null;
  cuisine: string | null;
};

export type SlotData = {
  id: string;
  day_of_week: number;
  course: string;
  option_number: number;
  status: "suggested" | "voted" | "confirmed";
  recipe: RecipeData | null;
};

function dayDate(weekStart: string, dow: number): string {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + dow);
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

function cuisineEmoji(cuisine: string | null): string {
  if (!cuisine) return "🍽️";
  const c = cuisine.toLowerCase();
  if (c.includes("italian")) return "🍝";
  if (c.includes("south african") || c.includes("braai")) return "🍖";
  if (c.includes("indian")) return "🍛";
  if (c.includes("asian") || c.includes("chinese") || c.includes("japanese") || c.includes("korean")) return "🍜";
  if (c.includes("mexican")) return "🌮";
  if (c.includes("mediterranean") || c.includes("greek")) return "🥗";
  if (c.includes("middle eastern")) return "🫒";
  if (c.includes("american")) return "🍔";
  if (c.includes("french")) return "🥐";
  if (c.includes("thai")) return "🥢";
  return "🍽️";
}

function scoreOf(votes: VoteData[]): number {
  return votes.reduce((s, v) => s + (v.value === "love" ? 3 : v.value === "up" ? 1 : -1), 0);
}

export function WeeklyCalendar({
  slots,
  initialVotes,
  memberId,
  weekStart,
  recipes: initialRecipes,
  aiRemaining: initialAiRemaining,
}: {
  slots: SlotData[];
  initialVotes: VoteData[];
  memberId: string;
  weekStart: string;
  recipes: RecipeData[];
  aiRemaining: number;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [votes, setVotes] = useState<VoteData[]>(initialVotes);
  const [voteError, setVoteError] = useState<string | null>(null);

  const [slotRecipes, setSlotRecipes] = useState<Map<string, RecipeData | null>>(
    () => new Map(slots.map((s) => [s.id, s.recipe]))
  );

  const [allRecipes, setAllRecipes] = useState<RecipeData[]>(initialRecipes);
  const [aiRemaining, setAiRemaining] = useState(initialAiRemaining);

  const [openPickerSlotId, setOpenPickerSlotId] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [aiLoadingSlotId, setAiLoadingSlotId] = useState<string | null>(null);
  const [loadingSlotId, setLoadingSlotId] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [firstVoteSlotId, setFirstVoteSlotId] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  useEffect(() => {
    const slotIds = new Set(slots.map((s) => s.id));

    const channel = supabase
      .channel("meal-plan-votes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes" },
        (payload) => {
          const incoming = (payload.new ?? {}) as Partial<VoteData>;
          const deleted = (payload.old ?? {}) as Partial<VoteData>;

          if (payload.eventType === "DELETE") {
            if (deleted.id) setVotes((prev) => prev.filter((v) => v.id !== deleted.id));
            return;
          }

          if (!incoming.meal_plan_slot_id || !slotIds.has(incoming.meal_plan_slot_id)) return;

          const vote = incoming as VoteData;
          setVotes((prev) => {
            const without = prev.filter(
              (v) => !(v.meal_plan_slot_id === vote.meal_plan_slot_id && v.member_id === vote.member_id)
            );
            return [...without, vote];
          });
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          setVoteError("Live updates disconnected — refresh to resync");
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [supabase, slots]);

  function handleVote(slotId: string, value: VoteValue) {
    setVoteError(null);

    const hadNoVotes = !votes.some((v) => v.meal_plan_slot_id === slotId);
    const myExisting = votes.find((v) => v.meal_plan_slot_id === slotId && v.member_id === memberId);
    const isFirstEver = hadNoVotes && !myExisting;

    setVotes((prev) => {
      const without = prev.filter(
        (v) => !(v.meal_plan_slot_id === slotId && v.member_id === memberId)
      );
      return [
        ...without,
        { id: `opt-${slotId}`, meal_plan_slot_id: slotId, member_id: memberId, value },
      ];
    });

    if (isFirstEver) {
      setFirstVoteSlotId(slotId);
      setTimeout(() => setFirstVoteSlotId(null), 2500);
    }

    startTransition(async () => {
      const error = await castVote(slotId, memberId, value);
      if (error) {
        setVotes((prev) => prev.filter((v) => v.id !== `opt-${slotId}`));
        setVoteError(error);
        setFirstVoteSlotId(null);
      }
    });
  }

  async function handleRemove(slotId: string) {
    setSlotError(null);
    const prev = slotRecipes.get(slotId) ?? null;
    setSlotRecipes((m) => new Map(m).set(slotId, null));
    setLoadingSlotId(slotId);
    const error = await removeFromSlot(slotId);
    setLoadingSlotId(null);
    if (error) {
      setSlotRecipes((m) => new Map(m).set(slotId, prev));
      setSlotError(error);
    }
  }

  async function handleAssign(slotId: string, recipe: RecipeData) {
    setOpenPickerSlotId(null);
    setPickerSearch("");
    setSlotError(null);
    const prev = slotRecipes.get(slotId) ?? null;
    setSlotRecipes((m) => new Map(m).set(slotId, recipe));
    setLoadingSlotId(slotId);
    const result = await assignRecipeToSlot(slotId, recipe.id);
    setLoadingSlotId(null);
    if ("error" in result) {
      setSlotRecipes((m) => new Map(m).set(slotId, prev));
      setSlotError(result.error);
      return;
    }
    // Apply the library reshuffle (this day's other options + de-duped other days)
    if (result.changed.length > 0) {
      setSlotRecipes((m) => {
        const next = new Map(m);
        for (const c of result.changed) next.set(c.slotId, c.recipe);
        return next;
      });
    }
  }

  async function handleAISuggest(slotId: string) {
    setOpenPickerSlotId(null);
    setPickerSearch("");
    setSlotError(null);
    setAiLoadingSlotId(slotId);
    setLoadingSlotId(slotId);
    const result = await suggestForSlot(slotId);
    setAiLoadingSlotId(null);
    setLoadingSlotId(null);

    if ("error" in result) {
      setSlotError(result.error);
      return;
    }

    setSlotRecipes((m) => new Map(m).set(slotId, result.recipe));
    setAllRecipes((prev) => [result.recipe, ...prev]);
    setAiRemaining((n) => Math.max(0, n - 1));
  }

  // (day|course) combos where this member has already voted (single-vote-per-course rule)
  const myVotedDayCourses = useMemo(() => {
    const set = new Set<string>();
    for (const slot of slots) {
      if (votes.some((v) => v.meal_plan_slot_id === slot.id && v.member_id === memberId)) {
        set.add(`${slot.day_of_week}|${slot.course}`);
      }
    }
    return set;
  }, [votes, slots, memberId]);

  // Group slots by day_of_week
  const dayGroups = useMemo(() => {
    const map = new Map<number, SlotData[]>();
    for (const slot of slots) {
      const group = map.get(slot.day_of_week) ?? [];
      group.push(slot);
      map.set(slot.day_of_week, group);
    }
    // Sort days 0-6
    return Array.from({ length: 7 }, (_, d) =>
      (map.get(d) ?? []).sort((a, b) => a.option_number - b.option_number)
    ).filter((g) => g.length > 0);
  }, [slots]);

  const filteredRecipes = allRecipes.filter((r) =>
    r.title.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {(voteError || slotError) && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
          {voteError || slotError}
        </p>
      )}

      {aiLoadingSlotId && (
        <p className="text-sm text-flame bg-flame-light px-4 py-3 rounded-xl">
          Claude is suggesting a meal&hellip;
        </p>
      )}

      {dayGroups.map((daySlots) => {
        const dow = daySlots[0].day_of_week;

        // Group the day's slots by course (starter → main → dessert → side)
        const courseGroups = COURSE_RENDER_ORDER
          .map((course) => ({
            course,
            courseSlots: daySlots
              .filter((s) => s.course === course)
              .sort((a, b) => a.option_number - b.option_number),
          }))
          .filter((g) => g.courseSlots.length > 0);
        const multiCourse = courseGroups.length > 1;

        return (
          <div
            key={dow}
            className="bg-[#FFF9F6] rounded-[14px] border border-[#F5D5C0] overflow-hidden"
          >
            {/* Day header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#F5D5C0]">
              <span className="text-sm font-semibold text-charcoal">
                {DAY_NAMES[dow]}
              </span>
              <span className="text-xs text-slate">{dayDate(weekStart, dow)}</span>
            </div>

            {courseGroups.map(({ course, courseSlots }) => {
              // Leading option within this course (highest score, or confirmed)
              const confirmedSlot = courseSlots.find((s) => s.status === "confirmed");
              const slotScores = courseSlots.map((s) => ({
                id: s.id,
                score: scoreOf(votes.filter((v) => v.meal_plan_slot_id === s.id)),
              }));
              const maxScore = Math.max(...slotScores.map((s) => s.score));
              const leadingSlotId =
                confirmedSlot?.id ??
                (maxScore > 0 ? (slotScores.find((s) => s.score === maxScore)?.id ?? null) : null);

              return (
                <div key={course}>
                  {multiCourse && (
                    <div className="px-4 pt-2.5 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-flame-dark">
                      {COURSE_LABELS[course as Course] ?? course}
                    </div>
                  )}
                  {/* Option cards */}
                  <div className="divide-y divide-[#F5D5C0]/60">
                    {courseSlots.map((slot) => {
                const recipe = slotRecipes.get(slot.id) ?? null;
                const slotVotes = votes.filter((v) => v.meal_plan_slot_id === slot.id);
                const myVote = slotVotes.find((v) => v.member_id === memberId)?.value ?? null;
                const counts = { love: 0, up: 0, down: 0 };
                slotVotes.forEach((v) => counts[v.value]++);
                const isLoading = loadingSlotId === slot.id;
                const isOpen = openPickerSlotId === slot.id;
                const isLeading = leadingSlotId === slot.id && recipe !== null;
                const isConfirmed = slot.status === "confirmed";
                const iVotedThisSlot = votes.some((v) => v.meal_plan_slot_id === slot.id && v.member_id === memberId);
                const dayAlreadyVoted = myVotedDayCourses.has(`${dow}|${slot.course}`) && !iVotedThisSlot;

                return (
                  <div
                    key={slot.id}
                    className={`transition-opacity ${isLoading ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    {/* Option row */}
                    <div className="flex items-center gap-2.5 px-3 py-2.5">
                      {/* Option indicator */}
                      <span className="shrink-0 w-5 h-5 rounded-full bg-cream border border-cream-border flex items-center justify-center text-[10px] font-bold text-slate">
                        {slot.option_number}
                      </span>

                      {recipe ? (
                        <>
                          {recipe.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={recipe.image_url}
                              alt=""
                              className="w-10 h-10 rounded-lg object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-flame-light shrink-0 flex items-center justify-center text-lg">
                              {cuisineEmoji(recipe.cuisine)}
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p className="text-sm font-medium text-charcoal truncate flex-1 min-w-0">
                                {recipe.title}
                              </p>
                              {isConfirmed && (
                                <span className="shrink-0 text-[10px] font-bold text-white bg-herb px-1.5 py-0.5 rounded-full">
                                  ✓ Won
                                </span>
                              )}
                              {isLeading && !isConfirmed && (
                                <span className="shrink-0 text-[10px] font-semibold text-flame-dark bg-flame-light px-1.5 py-0.5 rounded-full">
                                  Leading
                                </span>
                              )}
                            </div>
                            {recipe.prep_time || recipe.cuisine ? (
                              <p className="text-xs text-slate truncate mt-0.5">
                                {[recipe.prep_time ? `${recipe.prep_time} min` : null, recipe.cuisine]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setSlotError(null);
                                setPickerSearch("");
                                setOpenPickerSlotId((prev) => (prev === slot.id ? null : slot.id));
                              }}
                              className={`p-1 rounded-md text-xs transition-colors ${
                                isOpen ? "bg-flame-light text-flame" : "text-slate hover:text-charcoal hover:bg-cream"
                              }`}
                              title="Swap recipe"
                            >
                              ⇄
                            </button>
                            <button
                              onClick={() => handleRemove(slot.id)}
                              className="p-1 rounded-md text-slate hover:text-red-500 hover:bg-red-50 transition-colors text-xs"
                              title="Remove"
                            >
                              ✕
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setSlotError(null);
                            setPickerSearch("");
                            setOpenPickerSlotId((prev) => (prev === slot.id ? null : slot.id));
                          }}
                          className={`flex-1 flex items-center gap-2 text-sm transition-colors ${
                            isOpen ? "text-flame" : "text-slate hover:text-flame"
                          }`}
                        >
                          <span className="text-lg leading-none font-light">+</span>
                          <span>Add recipe</span>
                        </button>
                      )}
                    </div>

                    {/* Vote buttons — only show if recipe is present */}
                    {recipe && !isOpen && (
                      <div className="px-3 pb-2.5 space-y-1.5">
                        {firstVoteSlotId === slot.id && (
                          <div className="px-3 py-1.5 rounded-xl bg-turmeric-light text-turmeric-dark text-xs font-semibold text-center">
                            🎉 First to vote!
                          </div>
                        )}
                        {dayAlreadyVoted ? (
                          <p className="text-xs text-slate/60 italic px-1">
                            You&apos;ve voted for another meal today
                          </p>
                        ) : (
                          <div className="flex gap-1.5">
                          {(["love", "up", "down"] as VoteValue[]).map((val) => {
                            const { label, symbol, active, inactive } = VOTE_CONFIG[val];
                            const isActive = myVote === val;
                            return (
                              <button
                                key={val}
                                onClick={() => handleVote(slot.id, val)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                                  isActive ? active : inactive
                                }`}
                              >
                                <span>{symbol}</span>
                                <span>{label}</span>
                                {counts[val] > 0 && (
                                  <span className={isActive ? "opacity-80" : "opacity-50"}>
                                    {counts[val]}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Inline recipe picker */}
                    {isOpen && (
                      <div className="border-t border-[#F5D5C0]/60 px-3 pb-3 pt-2 space-y-2 bg-white/60">
                        {aiRemaining > 0 && (
                          <button
                            onClick={() => handleAISuggest(slot.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-turmeric-light hover:bg-[#FFF0C0] transition-colors text-left"
                          >
                            <span className="text-base shrink-0">✨</span>
                            <div>
                              <p className="text-xs font-semibold text-turmeric-dark">
                                AI suggest for this slot
                              </p>
                              <p className="text-xs text-slate">
                                {aiRemaining} of 5 remaining this week
                              </p>
                            </div>
                          </button>
                        )}

                        <input
                          type="text"
                          placeholder="Search your recipes…"
                          value={pickerSearch}
                          onChange={(e) => setPickerSearch(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-cream-border rounded-xl bg-white text-charcoal placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent"
                          autoFocus
                        />

                        <div className="max-h-48 overflow-y-auto space-y-0.5">
                          {filteredRecipes.length === 0 ? (
                            <p className="text-xs text-slate text-center py-4">No recipes found</p>
                          ) : (
                            filteredRecipes.map((r) => (
                              <button
                                key={r.id}
                                onClick={() => handleAssign(slot.id, r)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-cream transition-colors text-left"
                              >
                                {r.image_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={r.image_url}
                                    alt=""
                                    className="w-7 h-7 rounded-md object-cover shrink-0"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-md bg-flame-light shrink-0 flex items-center justify-center text-sm">
                                    {cuisineEmoji(r.cuisine)}
                                  </div>
                                )}
                                <p className="flex-1 text-sm font-medium text-charcoal truncate">
                                  {r.title}
                                </p>
                                <span className="text-xs font-semibold text-flame shrink-0">Pick</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
