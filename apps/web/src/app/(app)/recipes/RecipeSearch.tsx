"use client";

import { useActionState, useState } from "react";
import { searchSpoonacular, saveRecipe } from "./actions";
import type { SearchState } from "./actions";
import type { SpoonacularRecipe } from "@nomnate/types";
import { DIET_TYPE_LABELS } from "@nomnate/types";

const SEARCH_DIET_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "", label: "Any diet" },
  { key: "vegetarian", label: "Vegetarian" },
  { key: "vegan", label: "Vegan" },
  { key: "gluten-free", label: "Gluten-Free" },
  { key: "keto", label: "Keto" },
  { key: "paleo", label: "Paleo" },
  { key: "mediterranean", label: "Mediterranean" },
  { key: "whole30", label: "Whole30" },
  { key: "low-carb", label: "Low-Carb" },
];

const initial: SearchState = { results: [], error: null, dietFilter: "" };

export function RecipeSearch() {
  const [state, searchAction, searchPending] = useActionState(
    searchSpoonacular,
    initial
  );
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [savingId, setSavingId] = useState<number | null>(null);
  const [dietFilter, setDietFilter] = useState("");

  async function handleSave(recipe: SpoonacularRecipe) {
    setSavingId(recipe.id);
    const error = await saveRecipe(recipe);
    setSavingId(null);
    if (!error) setSavedIds((prev) => new Set([...prev, recipe.id]));
  }

  return (
    <div className="space-y-5">
      <form action={searchAction} className="space-y-3">
        {/* Diet filter */}
        <div className="flex flex-wrap gap-1.5">
          {SEARCH_DIET_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setDietFilter(dietFilter === opt.key ? "" : opt.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                dietFilter === opt.key
                  ? "bg-herb text-white"
                  : "bg-cream text-slate hover:bg-cream-dark"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <input type="hidden" name="diet_filter" value={dietFilter} />

        <div className="flex gap-2">
          <input
            name="query"
            type="search"
            required
            placeholder="e.g. pasta, chicken curry, stir fry…"
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-charcoal placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent"
          />
          <button
            type="submit"
            disabled={searchPending}
            className="bg-flame hover:bg-flame-dark disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-full text-sm transition-colors shrink-0"
          >
            {searchPending ? "Searching…" : "Search"}
          </button>
        </div>
      </form>

      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
          {state.error}
        </p>
      )}

      {state.results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate uppercase tracking-wide">
            {state.results.length} results
          </p>
          {state.results.map((recipe) => {
            const isSaved = savedIds.has(recipe.id);
            const isSaving = savingId === recipe.id;
            const dietTags = (recipe.diets ?? [])
              .map((d) => {
                const key = d.toLowerCase().replace(/ /g, "-");
                return DIET_TYPE_LABELS[key as keyof typeof DIET_TYPE_LABELS] ?? null;
              })
              .filter(Boolean)
              .slice(0, 2);

            return (
              <div
                key={recipe.id}
                className="flex items-center gap-3 rounded-[14px] border border-gray-200 bg-cream p-3"
              >
                {recipe.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={recipe.image}
                    alt=""
                    className="w-14 h-14 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-flame-light shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-charcoal truncate">
                    {recipe.title}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <p className="text-xs text-slate">
                      {[
                        recipe.readyInMinutes ? `${recipe.readyInMinutes} min` : null,
                        recipe.cuisines?.[0],
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {dietTags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-herb-light text-herb font-medium px-2 py-0.5 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleSave(recipe)}
                  disabled={isSaved || isSaving}
                  className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                    isSaved
                      ? "bg-herb-light text-herb"
                      : "bg-flame-light text-flame hover:bg-cream-dark disabled:opacity-60"
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
        <p className="text-sm text-slate text-center py-4">
          Search Spoonacular&apos;s database of 5,000+ recipes
        </p>
      )}
    </div>
  );
}
