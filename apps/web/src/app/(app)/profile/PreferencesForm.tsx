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
  allergies: string[];
  likedIngredients: string[];
};

function TagInput({
  values,
  onChange,
  placeholder,
  colorClass,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  colorClass: string;
}) {
  const [input, setInput] = useState("");

  function add() {
    const t = input.trim().toLowerCase();
    if (t && !values.includes(t)) onChange([...values, t]);
    setInput("");
  }

  const inputClass =
    "w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent";

  return (
    <div className="space-y-3">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((v) => (
            <span
              key={v}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${colorClass}`}
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="opacity-60 hover:opacity-100 leading-none"
                aria-label={`Remove ${v}`}
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
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(); }
          }}
          placeholder={placeholder}
          className={inputClass}
        />
        <button
          type="button"
          onClick={add}
          disabled={!input.trim()}
          className="shrink-0 px-4 py-2.5 rounded-lg bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-40 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function PreferencesForm({
  name,
  dietaryRestrictions,
  cuisinePreferences,
  ingredientDislikes,
  allergies,
  likedIngredients,
}: Props) {
  const [error, action, pending] = useActionState(updatePreferences, null);

  const [cuisines, setCuisines] = useState<string[]>(cuisinePreferences);
  const [dislikes, setDislikes] = useState<string[]>(ingredientDislikes);
  const [allergyList, setAllergyList] = useState<string[]>(allergies);
  const [likedList, setLikedList] = useState<string[]>(likedIngredients);

  function toggleCuisine(c: string) {
    setCuisines((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
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
            <label key={r} className="flex items-center gap-2.5 cursor-pointer group">
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

      {/* Allergies */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Allergies
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Serious allergies — recipes with these ingredients will be flagged.
          </p>
        </div>
        <input type="hidden" name="allergies" value={JSON.stringify(allergyList)} />
        <TagInput
          values={allergyList}
          onChange={setAllergyList}
          placeholder="e.g. peanuts, shellfish, gluten…"
          colorClass="bg-red-100 text-red-700"
        />
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
        <input type="hidden" name="cuisine_preferences" value={JSON.stringify(cuisines)} />
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

      {/* Liked ingredients */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Favourite ingredients
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Claude will try to include these in suggestions.
          </p>
        </div>
        <input type="hidden" name="liked_ingredients" value={JSON.stringify(likedList)} />
        <TagInput
          values={likedList}
          onChange={setLikedList}
          placeholder="e.g. chicken, avo, sweet potato…"
          colorClass="bg-green-50 text-green-700"
        />
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
        <input type="hidden" name="ingredient_dislikes" value={JSON.stringify(dislikes)} />
        <TagInput
          values={dislikes}
          onChange={setDislikes}
          placeholder="e.g. mushrooms, liver, olives…"
          colorClass="bg-red-50 text-red-700"
        />
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
