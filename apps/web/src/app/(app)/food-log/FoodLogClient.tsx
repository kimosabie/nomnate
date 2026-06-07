"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addLogEntryFromRecipe,
  addCustomLogEntry,
  deleteLogEntry,
  type LogEntry,
} from "./actions";

export type LibraryRecipe = { id: string; title: string; calories_per_serving: number | null };

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"] as const;
const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso: string, today: string): string {
  if (iso === today) return "Today";
  if (iso === shiftDate(today, -1)) return "Yesterday";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function FoodLogClient({
  date,
  today,
  entries: initialEntries,
  target,
  trackCalories,
  library,
}: {
  date: string;
  today: string;
  entries: LogEntry[];
  target: number | null;
  trackCalories: boolean;
  library: LibraryRecipe[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<LogEntry[]>(initialEntries);
  const [mealType, setMealType] = useState<string>("dinner");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [librarySearch, setLibrarySearch] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCalories, setCustomCalories] = useState("");

  const totalCalories = entries.reduce((s, e) => s + (e.calories ?? 0), 0);
  const totalP = entries.reduce((s, e) => s + (e.protein_g ?? 0), 0);
  const totalC = entries.reduce((s, e) => s + (e.carbs_g ?? 0), 0);
  const totalF = entries.reduce((s, e) => s + (e.fat_g ?? 0), 0);
  const pct = target ? Math.min(100, Math.round((totalCalories / target) * 100)) : null;
  const over = target != null && totalCalories > target;

  const groups = [...MEAL_ORDER, null].map((mt) => ({
    mt,
    items: entries.filter((e) => (e.meal_type ?? null) === mt),
  })).filter((g) => g.items.length > 0);

  const filteredLibrary = librarySearch
    ? library.filter((r) => r.title.toLowerCase().includes(librarySearch.toLowerCase())).slice(0, 8)
    : [];

  async function handleAddFromLibrary(recipe: LibraryRecipe) {
    setError(null);
    setBusy(true);
    const result = await addLogEntryFromRecipe({ recipeId: recipe.id, date, mealType, servings: 1 });
    setBusy(false);
    if ("error" in result) return setError(result.error);
    setEntries((prev) => [...prev, result.entry]);
    setLibrarySearch("");
  }

  async function handleAddCustom() {
    setError(null);
    const calories = customCalories ? Number(customCalories) : null;
    setBusy(true);
    const result = await addCustomLogEntry({
      date,
      label: customName,
      mealType,
      calories: calories != null && Number.isFinite(calories) ? calories : null,
    });
    setBusy(false);
    if ("error" in result) return setError(result.error);
    setEntries((prev) => [...prev, result.entry]);
    setCustomName("");
    setCustomCalories("");
    setShowCustom(false);
  }

  async function handleDelete(id: string) {
    setError(null);
    const prev = entries;
    setEntries((e) => e.filter((x) => x.id !== id));
    const result = await deleteLogEntry(id);
    if ("error" in result) {
      setEntries(prev);
      setError(result.error);
    }
  }

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push(`/food-log?date=${shiftDate(date, -1)}`)}
          className="px-3 py-1.5 rounded-full text-sm text-slate hover:text-charcoal hover:bg-white transition-colors"
          aria-label="Previous day"
        >
          ‹ Prev
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-charcoal">{fmtDate(date, today)}</p>
          {date !== today && (
            <button
              onClick={() => router.push("/food-log")}
              className="text-xs text-flame hover:text-flame-dark"
            >
              Jump to today
            </button>
          )}
        </div>
        <button
          onClick={() => router.push(`/food-log?date=${shiftDate(date, 1)}`)}
          disabled={date >= today}
          className="px-3 py-1.5 rounded-full text-sm text-slate hover:text-charcoal hover:bg-white transition-colors disabled:opacity-30"
          aria-label="Next day"
        >
          Next ›
        </button>
      </div>

      {/* Daily total */}
      <div className="bg-white rounded-[14px] border border-cream-border p-5">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-2xl font-display font-medium text-charcoal">{totalCalories}</span>
          <span className="text-sm text-slate">
            {target ? `of ${target} kcal` : "kcal"}
          </span>
        </div>
        {pct != null ? (
          <div className="h-2 rounded-full bg-cream overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${over ? "bg-red-400" : "bg-herb"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        ) : (
          <p className="text-xs text-slate">
            Set a daily calorie target in{" "}
            <Link href="/profile" className="text-flame hover:underline">Preferences</Link> to track against a goal.
          </p>
        )}
        <div className="flex gap-4 mt-3 text-xs text-slate">
          <span>P {totalP}g</span>
          <span>C {totalC}g</span>
          <span>F {totalF}g</span>
        </div>
      </div>

      {!trackCalories && (
        <p className="text-xs text-slate bg-cream border border-cream-border rounded-xl px-4 py-2.5">
          Calorie tracking is off in your preferences — entries here are just for your own diary.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}

      {/* Entries by meal */}
      {groups.length === 0 ? (
        <p className="text-sm text-slate text-center py-6">Nothing logged yet for this day.</p>
      ) : (
        groups.map((g) => (
          <div key={g.mt ?? "other"} className="bg-white rounded-[14px] border border-cream-border overflow-hidden">
            <div className="px-4 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-flame-dark">
              {g.mt ? MEAL_LABELS[g.mt] : "Other"}
            </div>
            <div className="divide-y divide-cream-border">
              {g.items.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal truncate">
                      {e.label}
                      {e.servings !== 1 && <span className="text-slate font-normal"> ×{e.servings}</span>}
                    </p>
                    <p className="text-xs text-slate">
                      {e.calories != null ? `${e.nutrition_estimated ? "~" : ""}${e.calories} kcal` : "— kcal"}
                      {(e.protein_g != null || e.carbs_g != null || e.fat_g != null) && (
                        <span> · P {e.protein_g ?? 0} C {e.carbs_g ?? 0} F {e.fat_g ?? 0}</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="p-1 rounded-md text-slate hover:text-red-500 hover:bg-red-50 transition-colors text-xs shrink-0"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Add entry */}
      <div className="bg-white rounded-[14px] border border-cream-border p-5 space-y-3">
        <p className="text-sm font-semibold text-charcoal">Add to {fmtDate(date, today).toLowerCase()}</p>

        {/* Meal-type selector */}
        <div className="flex gap-1.5">
          {MEAL_ORDER.map((mt) => (
            <button
              key={mt}
              onClick={() => setMealType(mt)}
              className={`flex-1 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                mealType === mt
                  ? "border-flame bg-flame text-white"
                  : "border-cream-border bg-white text-slate hover:border-flame/40"
              }`}
            >
              {MEAL_LABELS[mt]}
            </button>
          ))}
        </div>

        {/* From library */}
        <div>
          <input
            type="text"
            value={librarySearch}
            onChange={(ev) => setLibrarySearch(ev.target.value)}
            placeholder="Search your recipes to log…"
            disabled={busy}
            className="w-full px-3 py-2 text-sm border border-cream-border rounded-xl bg-white text-charcoal placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent"
          />
          {filteredLibrary.length > 0 && (
            <div className="mt-1 max-h-44 overflow-y-auto space-y-0.5">
              {filteredLibrary.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleAddFromLibrary(r)}
                  disabled={busy}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-cream transition-colors text-left disabled:opacity-50"
                >
                  <span className="flex-1 text-sm text-charcoal truncate">{r.title}</span>
                  {r.calories_per_serving != null && (
                    <span className="text-xs text-slate shrink-0">{r.calories_per_serving} kcal</span>
                  )}
                  <span className="text-xs font-semibold text-flame shrink-0">Log</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Custom entry */}
        {showCustom ? (
          <div className="space-y-2 border-t border-cream-border pt-3">
            <input
              type="text"
              value={customName}
              onChange={(ev) => setCustomName(ev.target.value)}
              placeholder="What did you eat?"
              maxLength={120}
              className="w-full px-3 py-2 text-sm border border-cream-border rounded-xl bg-white text-charcoal placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent"
            />
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                value={customCalories}
                onChange={(ev) => setCustomCalories(ev.target.value)}
                placeholder="kcal (optional)"
                className="flex-1 px-3 py-2 text-sm border border-cream-border rounded-xl bg-white text-charcoal placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent"
              />
              <button
                onClick={handleAddCustom}
                disabled={busy || !customName.trim()}
                className="px-4 py-2 rounded-full bg-flame hover:bg-flame-dark disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCustom(true)}
            className="text-xs font-semibold text-flame hover:text-flame-dark"
          >
            ＋ Add a custom item
          </button>
        )}
      </div>
    </div>
  );
}
