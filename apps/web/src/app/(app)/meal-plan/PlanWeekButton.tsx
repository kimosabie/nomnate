"use client";

import { useState, useTransition } from "react";
import { planWeekWithAI } from "./actions";

export function PlanWeekButton({ remaining }: { remaining: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const exhausted = remaining <= 0;

  function handle() {
    setError(null);
    startTransition(async () => {
      const err = await planWeekWithAI();
      if (err) {
        setError(err);
        return;
      }
      // Whole-week fill is a bulk change — reload so the calendar shows it fresh.
      window.location.reload();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}
      <button
        type="button"
        onClick={handle}
        disabled={pending || exhausted}
        className="w-full font-semibold px-5 py-2.5 rounded-full text-sm transition-colors disabled:opacity-60 bg-flame hover:bg-flame-dark text-white"
      >
        {pending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Planning your week…
          </span>
        ) : exhausted ? (
          "No AI suggestions left this week"
        ) : (
          "✨ Plan my whole week with AI"
        )}
      </button>
      {!exhausted && (
        <p className="text-xs text-slate text-center">
          Fills every empty day with options to vote on · uses 1 of your weekly suggestions
        </p>
      )}
    </div>
  );
}
