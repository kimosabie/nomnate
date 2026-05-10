"use client";

import Link from "next/link";
import { useState } from "react";
import { DeleteRecipeButton } from "./DeleteRecipeButton";
import { DIET_TYPE_LABELS, DIET_TYPES } from "@nomnate/types";

type Recipe = {
  id: string;
  title: string;
  image_url: string | null;
  prep_time: number | null;
  cuisine: string | null;
  is_favourite: boolean;
  emoji: string;
  conflicts: string[];
  isOwner: boolean;
  diet_types: string[];
  calories_per_serving: number | null;
};

export function RecipeListClient({
  recipes,
  toggleFavourite,
}: {
  recipes: Recipe[];
  toggleFavourite: (formData: FormData) => Promise<void>;
}) {
  const [hideConflicts, setHideConflicts] = useState(false);
  const [dietFilter, setDietFilter] = useState<string>("");

  const hasConflicts = recipes.some((r) => r.conflicts.length > 0);

  const allDietsPresent = [
    ...new Set(recipes.flatMap((r) => r.diet_types)),
  ].filter((d) => DIET_TYPES.includes(d as never));

  let filtered = hideConflicts ? recipes.filter((r) => r.conflicts.length === 0) : recipes;
  if (dietFilter) {
    filtered = filtered.filter((r) => r.diet_types.includes(dietFilter));
  }

  const favourites = filtered.filter((r) => r.is_favourite);
  const rest = filtered.filter((r) => !r.is_favourite);
  const displayed = [...favourites, ...rest];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate uppercase tracking-wide">
          Family recipes ({recipes.length})
        </h2>
        {hasConflicts && (
          <button
            onClick={() => setHideConflicts((v) => !v)}
            className="text-xs font-medium text-flame hover:text-flame-dark transition-colors"
          >
            {hideConflicts ? "Show all" : "Hide conflicts"}
          </button>
        )}
      </div>

      {/* Diet filter chips */}
      {allDietsPresent.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setDietFilter("")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              !dietFilter
                ? "bg-charcoal text-white"
                : "bg-cream text-slate hover:bg-cream-dark"
            }`}
          >
            All
          </button>
          {allDietsPresent.map((d) => (
            <button
              key={d}
              onClick={() => setDietFilter(dietFilter === d ? "" : d)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                dietFilter === d
                  ? "bg-herb text-white"
                  : "bg-cream text-slate hover:bg-cream-dark"
              }`}
            >
              {DIET_TYPE_LABELS[d as keyof typeof DIET_TYPE_LABELS] ?? d}
            </button>
          ))}
        </div>
      )}

      {!recipes.length ? (
        <p className="text-sm text-slate text-center py-8">
          No recipes saved yet — search above to add some
        </p>
      ) : displayed.length === 0 ? (
        <p className="text-sm text-slate text-center py-8">
          No recipes match this filter
        </p>
      ) : (
        <ul className="divide-y divide-cream-border/40">
          {displayed.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Link href={`/recipes/${r.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                {r.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.image_url}
                    alt=""
                    className="w-12 h-12 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-flame-light shrink-0 flex items-center justify-center text-xl">
                    {r.emoji}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-charcoal truncate">{r.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <p className="text-xs text-slate">
                      {[r.prep_time ? `${r.prep_time} min` : null, r.cuisine]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {r.calories_per_serving != null && (
                      <span className="text-xs text-turmeric-dark bg-turmeric-light font-medium px-2 py-0.5 rounded-full">
                        {r.calories_per_serving} kcal
                      </span>
                    )}
                    {r.conflicts.length > 0 && (
                      <span className="text-xs font-medium text-flame-dark bg-flame-light px-2 py-0.5 rounded-full">
                        N/A for {r.conflicts.join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              </Link>

              <div className="flex items-center gap-1 shrink-0">
                {r.isOwner && <DeleteRecipeButton recipeId={r.id} />}
                {r.isOwner ? (
                  <form action={toggleFavourite}>
                    <input type="hidden" name="recipeId" value={r.id} />
                    <input type="hidden" name="isFavourite" value={String(r.is_favourite)} />
                    <button
                      type="submit"
                      title={r.is_favourite ? "Remove from favourites" : "Add to favourites"}
                      className={`text-xl transition-transform hover:scale-110 leading-none ${
                        r.is_favourite ? "text-flame" : "text-slate/40"
                      }`}
                    >
                      &#9733;
                    </button>
                  </form>
                ) : (
                  <span className={`text-xl leading-none ${r.is_favourite ? "text-flame" : "text-slate/30"}`}>
                    &#9733;
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
