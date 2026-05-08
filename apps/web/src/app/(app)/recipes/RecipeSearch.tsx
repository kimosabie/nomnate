"use client";

import { useActionState, useState } from "react";
import { searchSpoonacular, saveRecipe } from "./actions";
import type { SearchState } from "./actions";
import type { SpoonacularRecipe } from "@nomnate/types";

const initial: SearchState = { results: [], error: null };

export function RecipeSearch() {
  const [state, searchAction, searchPending] = useActionState(
    searchSpoonacular,
    initial
  );
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [savingId, setSavingId] = useState<number | null>(null);

  async function handleSave(recipe: SpoonacularRecipe) {
    setSavingId(recipe.id);
    const error = await saveRecipe(recipe);
    setSavingId(null);
    if (!error) setSavedIds((prev) => new Set([...prev, recipe.id]));
  }

  return (
    <div className="space-y-5">
      <form action={searchAction} className="flex gap-2">
        <input
          name="query"
          type="search"
          required
          placeholder="e.g. pasta, chicken curry, stir fry…"
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={searchPending}
          className="bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors shrink-0"
        >
          {searchPending ? "Searching…" : "Search"}
        </button>
      </form>

      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
          {state.error}
        </p>
      )}

      {state.results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {state.results.length} results
          </p>
          {state.results.map((recipe) => {
            const isSaved = savedIds.has(recipe.id);
            const isSaving = savingId === recipe.id;
            return (
              <div
                key={recipe.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3"
              >
                {recipe.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={recipe.image}
                    alt=""
                    className="w-14 h-14 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-orange-100 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {recipe.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {[
                      recipe.readyInMinutes
                        ? `${recipe.readyInMinutes} min`
                        : null,
                      recipe.cuisines?.[0],
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <button
                  onClick={() => handleSave(recipe)}
                  disabled={isSaved || isSaving}
                  className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                    isSaved
                      ? "bg-green-50 text-green-600"
                      : "bg-orange-50 text-orange-600 hover:bg-orange-100 disabled:opacity-60"
                  }`}
                >
                  {isSaving ? "Adding…" : isSaved ? "Added ✓" : "Add"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!searchPending && state.results.length === 0 && !state.error && (
        <p className="text-sm text-gray-400 text-center py-4">
          Search Spoonacular&apos;s database of 5,000+ recipes
        </p>
      )}
    </div>
  );
}
