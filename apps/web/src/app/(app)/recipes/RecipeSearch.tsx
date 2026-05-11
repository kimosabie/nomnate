"use client";

import { useActionState, useState, useTransition } from "react";
import {
  searchRecipesAction,
  addRecipeToLibrary,
  saveSpoonacularRecipe,
  saveMealDBRecipe,
  seedSARecipes,
  searchMealDBRecipes,
  browseSouthAfricanMeals,
} from "./actions";
import type { SearchState, RecipeCard, MealDBState } from "./actions";
import type { SpoonacularRecipe } from "@nomnate/types";
import type { MealDBMeal, MealDBListItem } from "@nomnate/lib/themealdb";

type Tab = "search" | "themealdb" | "sa_staples";

const SOURCE_BADGE: Record<string, string> = {
  themealdb: "🌍 Community",
  ai: "✨ AI",
  manual: "👨‍🍳 Family",
  prescribed: "🏥 Prescribed",
};

const QUICK_FILTERS = [
  { key: "sa_classics", label: "🇿🇦 SA Classics" },
  { key: "braai", label: "🥩 Braai" },
  { key: "healthy", label: "🥗 Healthy" },
  { key: "quick", label: "⚡ Quick" },
];

const searchInitial: SearchState = {
  results: [],
  spoonResults: [],
  error: null,
  query: "",
  filter: null,
};

const mealdbInitial: MealDBState = {
  results: [],
  saItems: [],
  error: null,
  mode: "idle",
};

export function RecipeSearch() {
  const [activeTab, setActiveTab] = useState<Tab>("search");

  // Unified search tab
  const [searchState, searchAction, searchPending] = useActionState(
    searchRecipesAction,
    searchInitial
  );
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // TheMealDB tab
  const [mealdbState, mealdbSearchAction, mealdbPending] = useActionState(
    searchMealDBRecipes,
    mealdbInitial
  );
  const [savedMealDbIds, setSavedMealDbIds] = useState<Set<string>>(new Set());
  const [savingMealDbId, setSavingMealDbId] = useState<string | null>(null);
  const [mealdbBrowse, setMealdbBrowse] = useState<MealDBState>(mealdbInitial);
  const [saLoading, startSATransition] = useTransition();

  // SA Staples tab
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (tab === "themealdb" && mealdbBrowse.mode === "idle" && mealdbState.mode === "idle") {
      startSATransition(async () => {
        const result = await browseSouthAfricanMeals();
        setMealdbBrowse(result);
      });
    }
  }

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
    setSavingMealDbId(id);
    const err = await saveMealDBRecipe(id, title);
    setSavingMealDbId(null);
    if (!err) setSavedMealDbIds((prev) => new Set([...prev, id]));
  }

  async function handleSeed() {
    setSeeding(true);
    setSeedResult(null);
    const result = await seedSARecipes();
    setSeeding(false);
    if (result.error) {
      setSeedResult(`Error: ${result.error}`);
    } else if (result.seeded === 0 && result.skipped > 0) {
      setSeedResult(`All ${result.skipped} SA staples are already in your library.`);
    } else {
      setSeedResult(
        `Added ${result.seeded} SA staple${result.seeded !== 1 ? "s" : ""}${result.skipped > 0 ? ` (${result.skipped} already in global library, linked to yours)` : ""}.`
      );
    }
  }

  const mealdbResults = mealdbState.mode !== "idle" ? mealdbState : mealdbBrowse;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-cream rounded-xl p-1">
        {(["search", "themealdb", "sa_staples"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === tab
                ? "bg-white text-flame shadow-sm"
                : "text-slate hover:text-charcoal"
            }`}
          >
            {tab === "search" ? "Search" : tab === "themealdb" ? "TheMealDB" : "SA Staples"}
          </button>
        ))}
      </div>

      {/* ── Unified Search Tab ─────────────────────────────────────── */}
      {activeTab === "search" && (
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
              {searchPending ? "Searching…" : "Search"}
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

          {/* Spoonacular results (fallback when DB has < 6) */}
          {searchState.spoonResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate uppercase tracking-wide">
                {searchState.spoonResults.length} from Spoonacular
              </p>
              {searchState.spoonResults.map((r) => {
                const key = `spoon_${r.id}`;
                return (
                  <SpoonRecipeRow
                    key={r.id}
                    recipe={r}
                    isSaved={savedIds.has(key)}
                    isSaving={savingId === key}
                    onSave={handleSaveSpoonacular}
                  />
                );
              })}
            </div>
          )}

          {!searchPending &&
            searchState.results.length === 0 &&
            searchState.spoonResults.length === 0 &&
            !searchState.error && (
              <p className="text-sm text-slate text-center py-4">
                Search by name, or pick a quick filter above
              </p>
            )}
        </div>
      )}

      {/* ── TheMealDB Tab ──────────────────────────────────────────── */}
      {activeTab === "themealdb" && (
        <div className="space-y-4">
          <form action={mealdbSearchAction} className="flex gap-2">
            <input
              name="query"
              type="search"
              required
              placeholder="e.g. chicken, pasta, curry…"
              className="flex-1 px-4 py-2.5 border border-cream-border rounded-xl text-sm text-charcoal placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent"
            />
            <button
              type="submit"
              disabled={mealdbPending}
              className="bg-flame hover:bg-flame-dark disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-full text-sm transition-colors shrink-0"
            >
              {mealdbPending ? "Searching…" : "Search"}
            </button>
          </form>

          {(mealdbState.error || mealdbBrowse.error) && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
              {mealdbState.error ?? mealdbBrowse.error}
            </p>
          )}

          {(saLoading || mealdbPending) && (
            <p className="text-sm text-slate text-center py-4">Loading…</p>
          )}

          {!saLoading && !mealdbPending && mealdbResults.mode === "sa" && mealdbResults.saItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate uppercase tracking-wide">
                South African meals ({mealdbResults.saItems.length})
              </p>
              {mealdbResults.saItems.map((item) => (
                <MealDBListItemRow
                  key={item.idMeal}
                  item={item}
                  isSaved={savedMealDbIds.has(item.idMeal)}
                  isSaving={savingMealDbId === item.idMeal}
                  onSave={handleSaveMealDB}
                />
              ))}
            </div>
          )}

          {!saLoading && !mealdbPending && mealdbState.mode === "search" && mealdbState.results.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate uppercase tracking-wide">
                {mealdbState.results.length} result{mealdbState.results.length !== 1 ? "s" : ""}
              </p>
              {mealdbState.results.map((meal) => (
                <MealDBFullRow
                  key={meal.idMeal}
                  meal={meal}
                  isSaved={savedMealDbIds.has(meal.idMeal)}
                  isSaving={savingMealDbId === meal.idMeal}
                  onSave={handleSaveMealDB}
                />
              ))}
            </div>
          )}

          {!saLoading && !mealdbPending && mealdbState.mode === "search" && mealdbState.results.length === 0 && !mealdbState.error && (
            <p className="text-sm text-slate text-center py-4">No meals found — try a different search</p>
          )}

          {!saLoading && !mealdbPending && mealdbResults.mode === "idle" && (
            <p className="text-sm text-slate text-center py-4">Free recipe database — search any meal</p>
          )}
        </div>
      )}

      {/* ── SA Staples Tab ─────────────────────────────────────────── */}
      {activeTab === "sa_staples" && (
        <div className="space-y-4">
          <div className="bg-turmeric-light rounded-[14px] p-5">
            <p className="text-sm font-semibold text-charcoal mb-1">South African Staples</p>
            <p className="text-xs text-slate leading-relaxed mb-4">
              Add 10 classic SA recipes to your library — Bobotie, Potjiekos, Malva Pudding, Bunny Chow, and more.
            </p>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="w-full bg-flame hover:bg-flame-dark disabled:opacity-60 text-white font-semibold py-2.5 rounded-full text-sm transition-colors"
            >
              {seeding ? "Adding staples…" : "Add SA Staples to My Library"}
            </button>
            {seedResult && (
              <p className={`text-xs mt-3 text-center ${seedResult.startsWith("Error") ? "text-red-600" : "text-herb"}`}>
                {seedResult}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            {SA_STAPLE_NAMES.map((name) => (
              <div key={name} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-cream">
                <span className="w-1.5 h-1.5 rounded-full bg-flame shrink-0" />
                <span className="text-sm text-charcoal">{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const SA_STAPLE_NAMES = [
  "Bobotie", "Braai Boerewors", "Pap en Vleis", "Malva Pudding",
  "Potjiekos", "Vetkoek", "Bunny Chow", "Chakalaka", "Sosaties", "Melktert",
];

function sourceBadge(source: string) {
  const label = SOURCE_BADGE[source];
  if (!label) return null;
  return (
    <span className="text-xs bg-slate/10 text-slate font-medium px-2 py-0.5 rounded-full shrink-0">
      {label}
    </span>
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
          {sourceBadge(recipe.source)}
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

function SpoonRecipeRow({
  recipe,
  isSaved,
  isSaving,
  onSave,
}: {
  recipe: SpoonacularRecipe;
  isSaved: boolean;
  isSaving: boolean;
  onSave: (r: SpoonacularRecipe) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-cream-border bg-cream p-3">
      {recipe.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={recipe.image} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-flame-light shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-charcoal truncate">{recipe.title}</p>
        <p className="text-xs text-slate mt-0.5">
          {[recipe.readyInMinutes ? `${recipe.readyInMinutes} min` : null, recipe.cuisines?.[0]]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <AddButton inLibrary={isSaved} isSaving={isSaving} onClick={() => onSave(recipe)} />
    </div>
  );
}

function MealDBListItemRow({
  item,
  isSaved,
  isSaving,
  onSave,
}: {
  item: MealDBListItem;
  isSaved: boolean;
  isSaving: boolean;
  onSave: (id: string, title?: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-cream-border bg-cream p-3">
      {item.strMealThumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.strMealThumb} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-flame-light shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-charcoal truncate">{item.strMeal}</p>
        <p className="text-xs text-slate mt-0.5">South African · 🌍 Community</p>
      </div>
      <AddButton
        inLibrary={isSaved}
        isSaving={isSaving}
        onClick={() => onSave(item.idMeal, item.strMeal)}
      />
    </div>
  );
}

function MealDBFullRow({
  meal,
  isSaved,
  isSaving,
  onSave,
}: {
  meal: MealDBMeal;
  isSaved: boolean;
  isSaving: boolean;
  onSave: (id: string, title?: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-cream-border bg-cream p-3">
      {meal.strMealThumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={meal.strMealThumb} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-flame-light shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-charcoal truncate">{meal.strMeal}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="text-xs text-slate">
            {[meal.strCategory, meal.strArea].filter(Boolean).join(" · ")}
          </p>
          <span className="text-xs bg-slate/10 text-slate font-medium px-2 py-0.5 rounded-full">🌍 Community</span>
        </div>
      </div>
      <AddButton
        inLibrary={isSaved}
        isSaving={isSaving}
        onClick={() => onSave(meal.idMeal, meal.strMeal ?? undefined)}
      />
    </div>
  );
}
