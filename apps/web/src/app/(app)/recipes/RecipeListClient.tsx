"use client";

import Link from "next/link";
import { useState } from "react";
import { DeleteRecipeButton } from "./DeleteRecipeButton";

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
};

export function RecipeListClient({
  recipes,
  toggleFavourite,
}: {
  recipes: Recipe[];
  toggleFavourite: (formData: FormData) => Promise<void>;
}) {
  const [hideConflicts, setHideConflicts] = useState(false);

  const hasConflicts = recipes.some((r) => r.conflicts.length > 0);
  const filtered = hideConflicts
    ? recipes.filter((r) => r.conflicts.length === 0)
    : recipes;

  const favourites = filtered.filter((r) => r.is_favourite);
  const rest = filtered.filter((r) => !r.is_favourite);
  const displayed = [...favourites, ...rest];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Family recipes ({recipes.length})
        </h2>
        {hasConflicts && (
          <button
            onClick={() => setHideConflicts((v) => !v)}
            className="text-xs font-medium text-orange-500 hover:text-orange-600 transition-colors"
          >
            {hideConflicts ? "Show all" : "Hide conflicts"}
          </button>
        )}
      </div>

      {!recipes.length ? (
        <p className="text-sm text-gray-400 text-center py-8">
          No recipes saved yet — search above to add some
        </p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {displayed.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Link href={`/recipes/${r.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                {r.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.image_url}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-orange-50 shrink-0 flex items-center justify-center text-xl">
                    {r.emoji}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <p className="text-xs text-gray-400">
                      {[
                        r.prep_time ? `${r.prep_time} min` : null,
                        r.cuisine,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {r.conflicts.length > 0 && (
                      <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
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
                        r.is_favourite ? "text-orange-400" : "text-gray-300"
                      }`}
                    >
                      &#9733;
                    </button>
                  </form>
                ) : (
                  <span className={`text-xl leading-none ${r.is_favourite ? "text-orange-400" : "text-gray-200"}`}>
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
