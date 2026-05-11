"use client";

import { useActionState, useState, useTransition } from "react";
import {
  searchSpoonacular,
  saveRecipe,
  searchMealDBRecipes,
  browseSouthAfricanMeals,
  saveMealDBRecipe,
  seedSARecipes,
} from "./actions";
import type { SearchState, MealDBState } from "./actions";
import type { SpoonacularRecipe } from "@nomnate/types";
import type { MealDBMeal, MealDBListItem } from "@nomnate/lib/themealdb";
import { DIET_TYPE_LABELS } from "@nomnate/types";

type Tab = "spoonacular" | "themealdb" | "ai";

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

const spoonacularInitial: SearchState = { results: [], error: null, dietFilter: "" };
const mealdbInitial: MealDBState = { results: [], saItems: [], error: null, mode: "idle" };

export function RecipeSearch() {
  const [activeTab, setActiveTab] = useState<Tab>("spoonacular");

  // Spoonacular state
  const [spoonState, spoonSearchAction, spoonPending] = useActionState(searchSpoonacular, spoonacularInitial);
  const [savedSpoonIds, setSavedSpoonIds] = useState<Set<number>>(new Set());
  const [savingSpoonId, setSavingSpoonId] = useState<number | null>(null);
  const [dietFilter, setDietFilter] = useState("");

  // TheMealDB state
  const [mealdbState, mealdbSearchAction, mealdbPending] = useActionState(searchMealDBRecipes, mealdbInitial);
  const [savedMealDbIds, setSavedMealDbIds] = useState<Set<string>>(new Set());
  const [savingMealDbId, setSavingMealDbId] = useState<string | null>(null);
  const [mealdbDisplayState, setMealdbDisplayState] = useState<MealDBState>(mealdbInitial);
  const [saLoading, startSATransition] = useTransition();

  // AI Generate / Seed state
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (tab === "themealdb" && mealdbDisplayState.mode === "idle" && mealdbState.mode === "idle") {
      startSATransition(async () => {
        const result = await browseSouthAfricanMeals();
        setMealdbDisplayState(result);
      });
    }
  }

  async function handleSaveSpoon(recipe: SpoonacularRecipe) {
    setSavingSpoonId(recipe.id);
    const error = await saveRecipe(recipe);
    setSavingSpoonId(null);
    if (!error) setSavedSpoonIds((prev) => new Set([...prev, recipe.id]));
  }

  async function handleSaveMealDB(id: string, title?: string) {
    setSavingMealDbId(id);
    const error = await saveMealDBRecipe(id, title);
    setSavingMealDbId(null);
    if (!error) setSavedMealDbIds((prev) => new Set([...prev, id]));
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
      setSeedResult(`Added ${result.seeded} SA staple${result.seeded !== 1 ? "s" : ""}${result.skipped > 0 ? ` (${result.skipped} already existed)` : ""}.`);
    }
  }

  const mealdbResults = mealdbState.mode !== "idle" ? mealdbState : mealdbDisplayState;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-cream rounded-xl p-1">
        {(["spoonacular", "themealdb", "ai"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === tab
                ? "bg-white text-flame shadow-sm"
                : "text-slate hover:text-charcoal"
            }`}
          >
            {tab === "spoonacular" ? "Spoonacular" : tab === "themealdb" ? "TheMealDB" : "SA Staples"}
          </button>
        ))}
      </div>

      {/* Spoonacular tab */}
      {activeTab === "spoonacular" && (
        <div className="space-y-4">
          <form action={spoonSearchAction} className="space-y-3">
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
                className="flex-1 px-4 py-2.5 border border-cream-border rounded-xl text-sm text-charcoal placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent"
              />
              <button
                type="submit"
                disabled={spoonPending}
                className="bg-flame hover:bg-flame-dark disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-full text-sm transition-colors shrink-0"
              >
                {spoonPending ? "Searching…" : "Search"}
              </button>
            </div>
          </form>

          {spoonState.error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{spoonState.error}</p>
          )}

          {spoonState.results.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate uppercase tracking-wide">
                {spoonState.results.length} results
              </p>
              {spoonState.results.map((recipe) => {
                const isSaved = savedSpoonIds.has(recipe.id);
                const isSaving = savingSpoonId === recipe.id;
                const dietTags = (recipe.diets ?? [])
                  .map((d) => {
                    const key = d.toLowerCase().replace(/ /g, "-");
                    return DIET_TYPE_LABELS[key as keyof typeof DIET_TYPE_LABELS] ?? null;
                  })
                  .filter(Boolean)
                  .slice(0, 2);

                return (
                  <SpoonRecipeRow
                    key={recipe.id}
                    recipe={recipe}
                    isSaved={isSaved}
                    isSaving={isSaving}
                    dietTags={dietTags as string[]}
                    onSave={handleSaveSpoon}
                  />
                );
              })}
            </div>
          ) : (
            !spoonPending && !spoonState.error && (
              <p className="text-sm text-slate text-center py-4">
                Search Spoonacular&apos;s database of 5,000+ recipes
              </p>
            )
          )}
        </div>
      )}

      {/* TheMealDB tab */}
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

          {(mealdbState.error || mealdbDisplayState.error) && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
              {mealdbState.error ?? mealdbDisplayState.error}
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
            <p className="text-sm text-slate text-center py-4">
              Free recipe database with thousands of meals
            </p>
          )}
        </div>
      )}

      {/* SA Staples tab */}
      {activeTab === "ai" && (
        <div className="space-y-4">
          <div className="bg-turmeric-light rounded-[14px] p-5">
            <p className="text-sm font-semibold text-charcoal mb-1">South African Staples</p>
            <p className="text-xs text-slate leading-relaxed mb-4">
              Add 10 classic SA recipes to your library — Bobotie, Potjiekos, Malva Pudding, Bunny Chow, and more. These are pre-written and ready to use.
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
            {["Bobotie", "Braai Boerewors", "Pap en Vleis", "Malva Pudding", "Potjiekos", "Vetkoek", "Bunny Chow", "Chakalaka", "Sosaties", "Melktert"].map((name) => (
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

function SpoonRecipeRow({
  recipe,
  isSaved,
  isSaving,
  dietTags,
  onSave,
}: {
  recipe: SpoonacularRecipe;
  isSaved: boolean;
  isSaving: boolean;
  dietTags: string[];
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
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          <p className="text-xs text-slate">
            {[recipe.readyInMinutes ? `${recipe.readyInMinutes} min` : null, recipe.cuisines?.[0]]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {dietTags.map((tag) => (
            <span key={tag} className="text-xs bg-herb-light text-herb font-medium px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <button
        onClick={() => onSave(recipe)}
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
        <p className="text-xs text-slate mt-0.5">South African</p>
      </div>
      <button
        onClick={() => onSave(item.idMeal, item.strMeal)}
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
        <p className="text-xs text-slate mt-0.5">
          {[meal.strCategory, meal.strArea].filter(Boolean).join(" · ")}
        </p>
      </div>
      <button
        onClick={() => onSave(meal.idMeal, meal.strMeal ?? undefined)}
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
}
