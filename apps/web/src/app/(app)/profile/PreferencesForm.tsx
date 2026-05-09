"use client";

import { useActionState, useState } from "react";
import { updatePreferences } from "./actions";
import { DIETARY_RESTRICTIONS } from "@nomnate/types";

const CUISINES = [
  "South African",
  "Italian",
  "Indian",
  "Asian",
  "Mexican",
  "Mediterranean",
  "Middle Eastern",
  "American",
  "French",
  "Thai",
  "Japanese",
  "Greek",
  "Portuguese",
  "Chinese",
];

type Props = {
  name: string;
  dietaryRestrictions: string[];
  cuisinePreferences: string[];
  ingredientDislikes: string[];
};

export function PreferencesForm({
  name,
  dietaryRestrictions,
  cuisinePreferences,
  ingredientDislikes,
}: Props) {
  const [error, action, pending] = useActionState(updatePreferences, null);

  const [cuisines, setCuisines] = useState<string[]>(cuisinePreferences);
  const [dislikes, setDislikes] = useState<string[]>(ingredientDislikes);
  const [dislikeInput, setDislikeInput] = useState("");

  function toggleCuisine(c: string) {
    setCuisines((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  function addDislike() {
    const t = dislikeInput.trim().toLowerCase();
    if (t && !dislikes.includes(t)) setDislikes((prev) => [...prev, t]);
    setDislikeInput("");
  }

  function removeDislike(d: string) {
    setDislikes((prev) => prev.filter((x) => x !== d));
  }

  const inputClass =
    "w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent";

  return (
    <form action={action} className="space-y-8">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
          {error}
        </p>
      )}

      {/* Name */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Your name
        </h2>
        <input
          name="name"
          type="text"
          required
          defaultValue={name}
          placeholder="e.g. Mum"
          className={inputClass}
        />
      </div>

      {/* Dietary restrictions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Dietary restrictions
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Claude will never suggest meals that break these.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {DIETARY_RESTRICTIONS.map((r) => (
            <label
              key={r}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <input
                type="checkbox"
                name="dietary_restrictions"
                value={r}
                defaultChecked={dietaryRestrictions.includes(r)}
                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
              />
              <span className="text-sm text-gray-700 capitalize group-hover:text-gray-900">
                {r}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Cuisine preferences */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Favourite cuisines
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Claude will favour these when suggesting meals.
          </p>
        </div>
        <input
          type="hidden"
          name="cuisine_preferences"
          value={JSON.stringify(cuisines)}
        />
        <div className="flex flex-wrap gap-2">
          {CUISINES.map((c) => {
            const active = cuisines.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleCuisine(c)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  active
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ingredient dislikes */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Ingredients to avoid
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Meals with these ingredients won&apos;t be suggested.
          </p>
        </div>
        <input
          type="hidden"
          name="ingredient_dislikes"
          value={JSON.stringify(dislikes)}
        />
        {dislikes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {dislikes.map((d) => (
              <span
                key={d}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 text-sm font-medium"
              >
                {d}
                <button
                  type="button"
                  onClick={() => removeDislike(d)}
                  className="text-red-400 hover:text-red-600 leading-none"
                  aria-label={`Remove ${d}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={dislikeInput}
            onChange={(e) => setDislikeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDislike();
              }
            }}
            placeholder="e.g. mushrooms, liver, olives…"
            className={inputClass}
          />
          <button
            type="button"
            onClick={addDislike}
            disabled={!dislikeInput.trim()}
            className="shrink-0 px-4 py-2.5 rounded-lg bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-40 transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
      >
        {pending ? "Saving…" : "Save preferences"}
      </button>
    </form>
  );
}
