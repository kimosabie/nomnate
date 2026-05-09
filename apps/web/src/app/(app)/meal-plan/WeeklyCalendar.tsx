"use client";

import { useMemo, useState, useEffect, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  castVote,
  removeFromSlot,
  assignRecipeToSlot,
  suggestForSlot,
} from "./actions";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const VOTE_CONFIG = {
  love: { label: "Love", symbol: "♥", active: "bg-orange-500 text-white", inactive: "bg-gray-100 text-gray-500 hover:bg-orange-50 hover:text-orange-500" },
  up:   { label: "Yes",  symbol: "✓", active: "bg-green-500 text-white",  inactive: "bg-gray-100 text-gray-500 hover:bg-green-50  hover:text-green-600"  },
  down: { label: "No",   symbol: "✕", active: "bg-red-400 text-white",    inactive: "bg-gray-100 text-gray-500 hover:bg-red-50    hover:text-red-500"    },
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
  status: "suggested" | "voted" | "confirmed";
  recipe: RecipeData | null;
};

function dayDate(weekStart: string, dow: number): string {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + dow);
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
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

  // Votes state
  const [votes, setVotes] = useState<VoteData[]>(initialVotes);
  const [voteError, setVoteError] = useState<string | null>(null);

  // Slot recipes (optimistic map)
  const [slotRecipes, setSlotRecipes] = useState<Map<string, RecipeData | null>>(
    () => new Map(slots.map((s) => [s.id, s.recipe]))
  );

  // Recipe library (grows when per-slot AI adds new ones)
  const [allRecipes, setAllRecipes] = useState<RecipeData[]>(initialRecipes);
  const [aiRemaining, setAiRemaining] = useState(initialAiRemaining);

  // Picker state
  const [pickerSlotId, setPickerSlotId] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Per-slot loading & error
  const [loadingSlot, setLoadingSlot] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  // Realtime — votes
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
            if (deleted.id) {
              setVotes((prev) => prev.filter((v) => v.id !== deleted.id));
            }
            return;
          }

          if (!incoming.meal_plan_slot_id || !slotIds.has(incoming.meal_plan_slot_id)) return;

          const vote = incoming as VoteData;
          setVotes((prev) => {
            const without = prev.filter(
              (v) =>
                !(
                  v.meal_plan_slot_id === vote.meal_plan_slot_id &&
                  v.member_id === vote.member_id
                )
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, slots]);

  function handleVote(slotId: string, value: VoteValue) {
    setVoteError(null);
    setVotes((prev) => {
      const without = prev.filter(
        (v) => !(v.meal_plan_slot_id === slotId && v.member_id === memberId)
      );
      return [
        ...without,
        { id: `opt-${slotId}`, meal_plan_slot_id: slotId, member_id: memberId, value },
      ];
    });

    startTransition(async () => {
      const error = await castVote(slotId, memberId, value);
      if (error) {
        setVotes((prev) => prev.filter((v) => v.id !== `opt-${slotId}`));
        setVoteError(error);
      }
    });
  }

  function openPicker(slotId: string) {
    setSlotError(null);
    setPickerSearch("");
    setPickerSlotId(slotId);
  }

  function closePicker() {
    setPickerSlotId(null);
    setPickerSearch("");
  }

  async function handleRemove(slotId: string) {
    setSlotError(null);
    const prev = slotRecipes.get(slotId) ?? null;
    setSlotRecipes((m) => new Map(m).set(slotId, null));
    setLoadingSlot(slotId);

    const error = await removeFromSlot(slotId);
    setLoadingSlot(null);
    if (error) {
      setSlotRecipes((m) => new Map(m).set(slotId, prev));
      setSlotError(error);
    }
  }

  async function handleAssign(slotId: string, recipe: RecipeData) {
    closePicker();
    setSlotError(null);
    const prev = slotRecipes.get(slotId) ?? null;
    setSlotRecipes((m) => new Map(m).set(slotId, recipe));
    setLoadingSlot(slotId);

    const error = await assignRecipeToSlot(slotId, recipe.id);
    setLoadingSlot(null);
    if (error) {
      setSlotRecipes((m) => new Map(m).set(slotId, prev));
      setSlotError(error);
    }
  }

  async function handleAISuggest(slotId: string) {
    closePicker();
    setSlotError(null);
    setAiLoading(true);
    setLoadingSlot(slotId);

    const result = await suggestForSlot(slotId);
    setAiLoading(false);
    setLoadingSlot(null);

    if ("error" in result) {
      setSlotError(result.error);
      return;
    }

    setSlotRecipes((m) => new Map(m).set(slotId, result.recipe));
    setAllRecipes((prev) => [result.recipe, ...prev]);
    setAiRemaining((n) => Math.max(0, n - 1));
  }

  const sorted = [...slots].sort((a, b) => a.day_of_week - b.day_of_week);
  const pickerSlot = sorted.find((s) => s.id === pickerSlotId);

  const filteredRecipes = allRecipes.filter((r) =>
    r.title.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  return (
    <>
      <div className="space-y-3">
        {(voteError || slotError) && (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
            {voteError || slotError}
          </p>
        )}

        {aiLoading && (
          <p className="text-sm text-orange-600 bg-orange-50 px-4 py-3 rounded-lg">
            Claude is suggesting a meal&hellip;
          </p>
        )}

        {sorted.map((slot) => {
          const recipe = slotRecipes.get(slot.id) ?? null;
          const slotVotes = votes.filter((v) => v.meal_plan_slot_id === slot.id);
          const myVote = slotVotes.find((v) => v.member_id === memberId)?.value ?? null;
          const counts = { love: 0, up: 0, down: 0 };
          slotVotes.forEach((v) => counts[v.value]++);
          const isLoading = loadingSlot === slot.id;

          return (
            <div
              key={slot.id}
              className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-opacity ${
                isLoading ? "opacity-60 pointer-events-none" : ""
              }`}
            >
              {/* Day header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <span className="text-sm font-semibold text-gray-900">
                  {DAY_NAMES[slot.day_of_week]}
                </span>
                <span className="text-xs text-gray-400">
                  {dayDate(weekStart, slot.day_of_week)}
                </span>
              </div>

              {/* Recipe or empty state */}
              {recipe ? (
                <div className="flex items-center gap-3 px-4 py-3">
                  {recipe.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={recipe.image_url}
                      alt=""
                      className="w-14 h-14 rounded-xl object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-orange-50 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {recipe.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[
                        recipe.prep_time ? `${recipe.prep_time} min` : null,
                        recipe.cuisine,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openPicker(slot.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                      aria-label="Change meal"
                      title="Change meal"
                    >
                      ⇄
                    </button>
                    <button
                      onClick={() => handleRemove(slot.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      aria-label="Remove meal"
                      title="Remove meal"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3">
                  <button
                    onClick={() => openPicker(slot.id)}
                    className="w-full flex items-center gap-2 text-sm text-gray-400 hover:text-orange-500 transition-colors"
                  >
                    <span className="text-xl leading-none font-light">+</span>
                    <span>Add a meal</span>
                  </button>
                </div>
              )}

              {/* Vote buttons */}
              {recipe && (
                <div className="flex gap-2 px-4 pb-4">
                  {(["love", "up", "down"] as VoteValue[]).map((val) => {
                    const { label, symbol, active, inactive } = VOTE_CONFIG[val];
                    const isActive = myVote === val;
                    return (
                      <button
                        key={val}
                        onClick={() => handleVote(slot.id, val)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          isActive ? active : inactive
                        }`}
                      >
                        <span>{symbol}</span>
                        <span>{label}</span>
                        {counts[val] > 0 && (
                          <span className={`${isActive ? "opacity-80" : "opacity-60"}`}>
                            {counts[val]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recipe picker modal */}
      {pickerSlotId && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closePicker();
          }}
        >
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-xl">
            {/* Picker header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div>
                <p className="text-sm font-semibold text-gray-900">Pick a meal</p>
                {pickerSlot && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {DAY_NAMES[pickerSlot.day_of_week]},{" "}
                    {dayDate(weekStart, pickerSlot.day_of_week)}
                  </p>
                )}
              </div>
              <button
                onClick={closePicker}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* AI suggest for this slot */}
              {aiRemaining > 0 && (
                <div className="px-5 pt-4 pb-2">
                  <button
                    onClick={() => handleAISuggest(pickerSlotId)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-orange-50 hover:bg-orange-100 transition-colors text-left"
                  >
                    <span className="text-lg shrink-0">✨</span>
                    <div>
                      <p className="text-sm font-semibold text-orange-700">
                        AI suggest for this day
                      </p>
                      <p className="text-xs text-orange-500">
                        {aiRemaining} of 5 remaining this week
                      </p>
                    </div>
                  </button>
                </div>
              )}

              {/* Search */}
              <div className="px-5 pt-3 pb-2">
                <input
                  type="text"
                  placeholder="Search your recipes…"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />
              </div>

              {/* Recipe list */}
              <div className="px-5 pb-5 space-y-1">
                {filteredRecipes.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No recipes found</p>
                ) : (
                  filteredRecipes.map((recipe) => (
                    <button
                      key={recipe.id}
                      onClick={() => handleAssign(pickerSlotId, recipe)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left"
                    >
                      {recipe.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={recipe.image_url}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-orange-50 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {recipe.title}
                        </p>
                        <p className="text-xs text-gray-400">
                          {[
                            recipe.prep_time ? `${recipe.prep_time} min` : null,
                            recipe.cuisine,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-orange-500 shrink-0">
                        Pick
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
