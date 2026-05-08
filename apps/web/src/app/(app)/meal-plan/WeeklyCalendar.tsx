"use client";

import { useMemo, useState, useEffect, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { castVote } from "./actions";

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
}: {
  slots: SlotData[];
  initialVotes: VoteData[];
  memberId: string;
  weekStart: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [votes, setVotes] = useState<VoteData[]>(initialVotes);
  const [, startTransition] = useTransition();
  const [voteError, setVoteError] = useState<string | null>(null);

  // Realtime — merge incoming vote changes into local state
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, slots]);

  function handleVote(slotId: string, value: VoteValue) {
    setVoteError(null);

    // Optimistic update — use a temp id that gets overwritten by realtime
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
        // Revert optimistic update
        setVotes((prev) => prev.filter((v) => v.id !== `opt-${slotId}`));
        setVoteError(error);
      }
    });
  }

  const sorted = [...slots].sort((a, b) => a.day_of_week - b.day_of_week);

  return (
    <div className="space-y-3">
      {voteError && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
          {voteError}
        </p>
      )}

      {sorted.map((slot) => {
        const slotVotes = votes.filter((v) => v.meal_plan_slot_id === slot.id);
        const myVote = slotVotes.find((v) => v.member_id === memberId)?.value ?? null;
        const counts = { love: 0, up: 0, down: 0 };
        slotVotes.forEach((v) => counts[v.value]++);

        return (
          <div
            key={slot.id}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
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

            {/* Recipe */}
            {slot.recipe ? (
              <div className="flex items-center gap-3 px-4 py-3">
                {slot.recipe.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slot.recipe.image_url}
                    alt=""
                    className="w-14 h-14 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-orange-50 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {slot.recipe.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {[
                      slot.recipe.prep_time
                        ? `${slot.recipe.prep_time} min`
                        : null,
                      slot.recipe.cuisine,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3">
                <p className="text-sm text-gray-400 italic">No recipe — add more to your collection</p>
              </div>
            )}

            {/* Vote buttons */}
            {slot.recipe && (
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
  );
}
