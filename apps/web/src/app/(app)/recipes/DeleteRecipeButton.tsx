"use client";

import { useState, useTransition } from "react";
import { deleteRecipe } from "./actions";

export function DeleteRecipeButton({ recipeId }: { recipeId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (confirming) {
    return (
      <span className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => {
            startTransition(async () => {
              const err = await deleteRecipe(recipeId);
              if (err) { setError(err); setConfirming(false); }
            });
          }}
          className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors"
        >
          Delete
        </button>
        <span className="text-gray-300">|</span>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="shrink-0 p-1.5 text-gray-300 hover:text-red-400 transition-colors rounded"
      aria-label="Delete recipe"
      title="Delete recipe"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );
}
