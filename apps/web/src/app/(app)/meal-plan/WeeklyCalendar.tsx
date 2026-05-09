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
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

const VOTE_CONFIG = {
  love: {
    label: "Love", symbol: "♥",
    active:   "bg-flame-light text-flame-dark",
    inactive: "bg-gray-100 text-slate hover:bg-flame-light hover:text-flame-dark",
  },
  up: {
    label: "Yes", symbol: "✓",
    active:   "bg-herb-light text-herb",
    inactive: "bg-gray-100 text-slate hover:bg-herb-light hover:text-herb",
  },
  down: {
    label: "No", symbol: "✕",
    active:   "bg-gray-200 text-slate",
    inactive: "bg-gray-100 text-slate hover:bg-gray-200",
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

  const [openSlotId, setOpenSlotId] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const [loadingSlot, setLoadingSlot] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);

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

  function openPicker(slotId: string) {
    setSlotError(null);
    setPickerSearch("");
    setOpenSlotId((prev) => (prev === slotId ? null : slotId));
  }

  function closePicker() {
    setOpenSlotId(null);
    setPickerSearch("");
  }

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

      {aiLoading && (
        <p className="text-sm text-flame bg-flame-light px-4 py-3 rounded-xl">
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
        const isOpen = openSlotId === slot.id;

        return (
          <div
            key={slot.id}
            className={`bg-[#FFF9F6] rounded-[14px] border border-[#F5D5C0] overflow-hidden transition-opacity ${
              isLoading ? "opacity-60 pointer-events-none" : ""
            }`}
          >
            {/* Day header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#F5D5C0]">
              <span className="text-sm font-semibold text-charcoal">
                {DAY_NAMES[slot.day_of_week]}
              </span>
              <span className="text-xs text-slate">
                {dayDate(weekStart, slot.day_of_week)}
              </span>
            </div>

            {/* Recipe or add button */}
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
                  <div className="w-14 h-14 rounded-xl bg-flame-light shrink-0 flex items-center justify-center text-2xl">
                    {cuisineEmoji(recipe.cuisine)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-charcoal truncate">
                    {recipe.title}
                  </p>
                  <p className="text-xs text-slate mt-0.5">
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
                    className={`p-1.5 rounded-lg transition-colors ${
                      isOpen
                        ? "bg-flame-light text-flame"
                        : "text-slate hover:text-charcoal hover:bg-cream"
                    }`}
                    aria-label="Change meal"
                    title="Change meal"
                  >
                    ⇄
                  </button>
                  <button
                    onClick={() => handleRemove(slot.id)}
                    className="p-1.5 rounded-lg text-slate hover:text-red-500 hover:bg-red-50 transition-colors"
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
                  className={`w-full flex items-center gap-2 text-sm transition-colors ${
                    isOpen ? "text-flame" : "text-slate hover:text-flame"
                  }`}
                >
                  <span className="text-xl leading-none font-light">+</span>
                  <span>Add a meal</span>
                </button>
              </div>
            )}

            {/* Vote buttons */}
            {recipe && !isOpen && (
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
                        <span className={isActive ? "opacity-80" : "opacity-60"}>
                          {counts[val]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Inline recipe picker */}
            {isOpen && (
              <div className="border-t border-[#F5D5C0] px-3 pb-3 pt-2 space-y-2">
                {aiRemaining > 0 && (
                  <button
                    onClick={() => handleAISuggest(slot.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-turmeric-light hover:bg-[#FFF0C0] transition-colors text-left"
                  >
                    <span className="text-base shrink-0">✨</span>
                    <div>
                      <p className="text-xs font-semibold text-turmeric-dark">
                        AI suggest for this day
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
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white text-charcoal placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />

                <div className="max-h-52 overflow-y-auto space-y-0.5">
                  {filteredRecipes.length === 0 ? (
                    <p className="text-xs text-slate text-center py-4">No recipes found</p>
                  ) : (
                    filteredRecipes.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => handleAssign(slot.id, r)}
                        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-cream transition-colors text-left"
                      >
                        {r.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.image_url}
                            alt=""
                            className="w-8 h-8 rounded-md object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-flame-light shrink-0 flex items-center justify-center text-sm">
                            {cuisineEmoji(r.cuisine)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-charcoal truncate">{r.title}</p>
                          <p className="text-xs text-slate truncate">
                            {[r.prep_time ? `${r.prep_time} min` : null, r.cuisine].filter(Boolean).join(" · ")}
                          </p>
                        </div>
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
  );
}
