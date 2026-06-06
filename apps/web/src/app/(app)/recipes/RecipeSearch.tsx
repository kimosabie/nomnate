"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  searchRecipesAction,
  addRecipeToLibrary,
  saveMealDBRecipe,
} from "./actions";
import { saveSpoonacularRecipe } from "./spoonacular-actions";
import type { SearchState, RecipeCard } from "./actions";
import type { SpoonacularRecipe } from "@nomnate/types";

const QUICK_FILTERS = [
  { key: "sa_classics", label: "🇿🇦 SA Classics" },
  { key: "braai",       label: "🥩 Braai" },
  { key: "healthy",     label: "🥗 Healthy" },
  { key: "quick",       label: "⚡ Under 30min" },
  { key: "favourites",  label: "❤️ Favourites" },
  { key: "family",      label: "👨‍🍳 Family" },
];

function sourceBadge(source: string, cuisine?: string | null): string | null {
  if (source === "web_reference" || (source === "ai" && cuisine?.toLowerCase().includes("south african"))) return "🇿🇦 SA Classic";
  if (source === "themealdb") return "🌍 TheMealDB";
  if (source === "ai") return "✨ AI Chef";
  if (source === "manual") return "👨‍🍳 Family";
  if (source === "prescribed") return "🏥 Prescribed";
  return null;
}

const searchInitial: SearchState = {
  results: [],
  externalResults: [],
  error: null,
  query: "",
  filter: null,
};

export function RecipeSearch() {
  const [searchState, searchAction, searchPending] = useActionState(
    searchRecipesAction,
    searchInitial
  );
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  async function handleSaveDBResult(recipeId: string) {
    setSavingId(recipeId);
    const err = await addRecipeToLibrary(recipeId);
    setSavingId(null);
    if (!err) setSavedIds((prev) => new Set([...prev, recipeId]));
  }

  async function handleSaveSpoonacular(recipe: SpoonacularRecipe) {
    const key = `spoon_${recipe.id}`;
    setSavingId(key);
    const err = await saveSpoonacularRecipe(recipe);
    setSavingId(null);
    if (!err) setSavedIds((prev) => new Set([...prev, key]));
  }

  async function handleSaveMealDB(id: string, title?: string) {
    setSavingId(`mealdb_${id}`);
    const err = await saveMealDBRecipe(id, title);
    setSavingId(null);
    if (!err) setSavedIds((prev) => new Set([...prev, `mealdb_${id}`]));
  }

  const hasResults = searchState.results.length > 0 || searchState.externalResults.length > 0;
  const searched = searchState.query || searchState.filter;

  return (
    <div className="space-y-4">
      {/* Quick filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setActiveFilter(activeFilter === f.key ? null : f.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeFilter === f.key
                ? "bg-flame text-white"
                : "bg-cream text-slate hover:bg-cream-dark"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <form action={searchAction} className="flex gap-2">
        <input type="hidden" name="filter" value={activeFilter ?? ""} />
        <input
          name="query"
          type="search"
          placeholder="Search recipes…"
          className="flex-1 px-4 py-2.5 border border-cream-border rounded-xl text-sm text-charcoal placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent"
        />
        <button
          type="submit"
          disabled={searchPending}
          className="bg-flame hover:bg-flame-dark disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-full text-sm transition-colors shrink-0"
        >
          {searchPending ? "Searching…" : "Go"}
        </button>
      </form>

      {searchState.error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
          {searchState.error}
        </p>
      )}

      {/* DB results */}
      {searchState.results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate uppercase tracking-wide">
            {searchState.results.length} in NomNate library
          </p>
          {searchState.results.map((r) => (
            <DBRecipeRow
              key={r.id}
              recipe={r}
              isSaved={r.inLibrary || savedIds.has(r.id)}
              isSaving={savingId === r.id}
              onAdd={handleSaveDBResult}
            />
          ))}
        </div>
      )}

      {/* External results (Spoonacular + TheMealDB merged) */}
      {searchState.externalResults.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate uppercase tracking-wide">
            {searchState.externalResults.length} found online
          </p>
          {searchState.externalResults.map((ext) => {
            if (ext.source === "spoonacular") {
              const key = `spoon_${ext.recipe.id}`;
              return (
                <ExternalRecipeRow
                  key={key}
                  title={ext.recipe.title}
                  image={ext.recipe.image ?? null}
                  prepTime={ext.recipe.readyInMinutes ?? null}
                  cuisine={ext.recipe.cuisines?.[0] ?? null}
                  badge={null}
                  isSaved={savedIds.has(key)}
                  isSaving={savingId === key}
                  onSave={() => handleSaveSpoonacular(ext.recipe)}
                />
              );
            }
            const mkey = `mealdb_${ext.meal.idMeal}`;
            return (
              <ExternalRecipeRow
                key={mkey}
                title={ext.meal.strMeal ?? ""}
                image={ext.meal.strMealThumb ?? null}
                prepTime={null}
                cuisine={ext.meal.strArea ?? null}
                badge="🌍 TheMealDB"
                isSaved={savedIds.has(mkey)}
                isSaving={savingId === mkey}
                onSave={() => handleSaveMealDB(ext.meal.idMeal, ext.meal.strMeal ?? undefined)}
              />
            );
          })}
        </div>
      )}

      {!searchPending && searched && !hasResults && !searchState.error && (
        <p className="text-sm text-slate text-center py-4">
          No recipes found — try a different search
        </p>
      )}

      {!searched && !searchPending && (
        <p className="text-sm text-slate text-center py-4">
          Search by name or pick a filter above
        </p>
      )}

      {/* AI Chef CTA */}
      <div className="mt-2 rounded-[14px] border border-cream-border bg-gradient-to-br from-flame-light to-turmeric-light p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0">🤖</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-charcoal">Ask our AI Chef</p>
            <p className="text-xs text-slate mt-0.5 leading-relaxed">
              Tell the AI Chef what you&apos;re in the mood for and it&apos;ll create a custom recipe for your family.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2.5 mb-3">
              {["Keto dinner for 4", "SA braai sides", "Vegetarian under 30min", "Kids will eat it"].map((s) => (
                <span key={s} className="text-xs bg-white/70 text-slate px-2 py-0.5 rounded-full border border-white/50">
                  {s}
                </span>
              ))}
            </div>
            <Link
              href="/recipes/ai-chef"
              className="inline-block bg-flame hover:bg-flame-dark text-white font-semibold px-5 py-2 rounded-full text-xs transition-colors"
            >
              👨‍🍳 Create with AI Chef
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddButton({
  inLibrary,
  isSaving,
  onClick,
}: {
  inLibrary: boolean;
  isSaving: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={inLibrary || isSaving}
      className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
        inLibrary
          ? "bg-herb-light text-herb cursor-default"
          : "bg-flame-light text-flame hover:bg-cream-dark disabled:opacity-60"
      }`}
    >
      {isSaving ? "Adding…" : inLibrary ? "In Library" : "Add"}
    </button>
  );
}

function DBRecipeRow({
  recipe,
  isSaved,
  isSaving,
  onAdd,
}: {
  recipe: RecipeCard;
  isSaved: boolean;
  isSaving: boolean;
  onAdd: (id: string) => void;
}) {
  const badge = sourceBadge(recipe.source, recipe.cuisine);
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-cream-border bg-cream p-3">
      {recipe.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={recipe.image_url} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-flame-light shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-charcoal truncate">{recipe.title}</p>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          <p className="text-xs text-slate">
            {[recipe.prep_time ? `${recipe.prep_time} min` : null, recipe.cuisine]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {badge && (
            <span className="text-xs bg-slate/10 text-slate font-medium px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
      </div>
      <AddButton
        inLibrary={isSaved}
        isSaving={isSaving}
        onClick={() => onAdd(recipe.id)}
      />
    </div>
  );
}

function ExternalRecipeRow({
  title,
  image,
  prepTime,
  cuisine,
  badge,
  isSaved,
  isSaving,
  onSave,
}: {
  title: string;
  image: string | null;
  prepTime: number | null;
  cuisine: string | null;
  badge: string | null;
  isSaved: boolean;
  isSaving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-cream-border bg-cream p-3">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-flame-light shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-charcoal truncate">{title}</p>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          <p className="text-xs text-slate">
            {[prepTime ? `${prepTime} min` : null, cuisine].filter(Boolean).join(" · ")}
          </p>
          {badge && (
            <span className="text-xs bg-slate/10 text-slate font-medium px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
      </div>
      <AddButton inLibrary={isSaved} isSaving={isSaving} onClick={onSave} />
    </div>
  );
}
