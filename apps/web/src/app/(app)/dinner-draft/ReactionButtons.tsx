"use client";
import type { DraftReaction } from "@nomnate/shared";
const labels: Record<DraftReaction, string> = { love: "❤️ Love", eat: "👍 Eat it", whatever: "😐 Whatever", nope: "👎 Nope" };
export function ReactionButtons({ reaction, disabled, onReact, recipeTitle }: { recipeTitle: string; reaction: DraftReaction | null; disabled: boolean; onReact: (reaction: DraftReaction) => void }) {
  return <div role="group" aria-label={`Your reaction to ${recipeTitle}`} className="grid grid-cols-2 gap-2">
    {(Object.keys(labels) as DraftReaction[]).map(value => <button key={value} type="button" disabled={disabled} aria-pressed={reaction === value} onClick={() => onReact(value)}
      className={`min-h-11 rounded-lg border p-2 text-sm font-medium disabled:opacity-60 ${reaction === value ? "bg-flame text-white border-flame ring-2 ring-flame ring-offset-2" : "border-cream-border bg-white text-charcoal"}`}>{labels[value]}{reaction === value ? " ✓" : ""}</button>)}
  </div>;
}
