"use client";

import { useActionState, useState } from "react";
import { updatePreferences } from "./actions";
import { DIETARY_RESTRICTIONS, DIET_TYPES, DIET_TYPE_LABELS, CUISINES } from "@nomnate/types";

const RELATIONSHIPS: { value: string; emoji: string; label: string }[] = [
  { value: "mom",          emoji: "👩",  label: "Mom" },
  { value: "dad",          emoji: "👨",  label: "Dad" },
  { value: "grandmother",  emoji: "👵",  label: "Grandma" },
  { value: "grandfather",  emoji: "👴",  label: "Grandpa" },
  { value: "brother",      emoji: "👦",  label: "Brother" },
  { value: "sister",       emoji: "👧",  label: "Sister" },
  { value: "son",          emoji: "👶",  label: "Son" },
  { value: "daughter",     emoji: "🌸",  label: "Daughter" },
  { value: "uncle",        emoji: "👨‍👦",  label: "Uncle" },
  { value: "aunt",         emoji: "👩‍👦",  label: "Aunt" },
  { value: "cousin",       emoji: "👫",  label: "Cousin" },
  { value: "other",        emoji: "😊",  label: "Other" },
];

function computeAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

type Props = {
  name: string;
  dietaryRestrictions: string[];
  cuisinePreferences: string[];
  ingredientDislikes: string[];
  allergies: string[];
  likedIngredients: string[];
  dietTypes: string[];
  dailyCalorieTarget: number | null;
  trackCalories: boolean;
  relationship: string | null;
  dateOfBirth: string | null;
};

const inputClass =
  "w-full px-4 py-2.5 border border-cream-border rounded-xl text-sm text-charcoal placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent";

function TagInput({
  values,
  onChange,
  placeholder,
  chipClass,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  chipClass: string;
}) {
  const [input, setInput] = useState("");

  function add() {
    const t = input.trim().toLowerCase();
    if (t && !values.includes(t)) onChange([...values, t]);
    setInput("");
  }

  return (
    <div className="space-y-3">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((v) => (
            <span key={v} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${chipClass}`}>
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
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className={inputClass}
        />
        <button
          type="button"
          onClick={add}
          disabled={!input.trim()}
          className="shrink-0 px-4 py-2.5 rounded-full bg-cream text-sm font-medium text-charcoal hover:bg-cream-dark disabled:opacity-40 transition-colors"
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
  dietTypes,
  dailyCalorieTarget,
  trackCalories,
  relationship,
  dateOfBirth,
}: Props) {
  const [error, action, pending] = useActionState(updatePreferences, null);

  const [cuisines, setCuisines] = useState<string[]>(cuisinePreferences);
  const [dislikes, setDislikes] = useState<string[]>(ingredientDislikes);
  const [allergyList, setAllergyList] = useState<string[]>(allergies);
  const [likedList, setLikedList] = useState<string[]>(likedIngredients);
  const [selectedDietTypes, setSelectedDietTypes] = useState<string[]>(dietTypes);
  const [caloriesEnabled, setCaloriesEnabled] = useState(trackCalories);
  const [selectedRelationship, setSelectedRelationship] = useState<string | null>(relationship);
  const [dob, setDob] = useState(dateOfBirth ?? "");

  function toggleCuisine(c: string) {
    setCuisines((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  }

  function toggleDietType(d: string) {
    setSelectedDietTypes((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  }

  return (
    <form action={action} className="space-y-8">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}

      {/* Name */}
      <div className="bg-white rounded-[14px] border border-cream-border p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate uppercase tracking-wide">Your name</h2>
        <input
          name="name"
          type="text"
          required
          defaultValue={name}
          placeholder="e.g. Mum"
          className={inputClass}
        />
      </div>

      {/* Relationship */}
      <div className="bg-white rounded-[14px] border border-cream-border p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate uppercase tracking-wide">Who are you?</h2>
        <input type="hidden" name="relationship" value={selectedRelationship ?? ""} />
        <div className="grid grid-cols-2 gap-2">
          {RELATIONSHIPS.map((r) => {
            const active = selectedRelationship === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => setSelectedRelationship(active ? null : r.value)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-full text-[13px] font-medium transition-all border"
                style={{
                  background: active ? "#E8621A" : "#FFF3EE",
                  borderColor: active ? "#E8621A" : "#F5D5C0",
                  color: active ? "#fff" : "#1A1A1A",
                }}
              >
                <span>{r.emoji}</span>
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Age / Date of birth */}
      <div className="bg-white rounded-[14px] border border-cream-border p-6 space-y-3">
        <h2 className="text-sm font-semibold text-slate uppercase tracking-wide">How old are you?</h2>
        <input
          name="date_of_birth"
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          className={inputClass + " max-w-xs"}
        />
        {dob && !isNaN(new Date(dob).getTime()) && (() => {
          const age = computeAge(dob);
          if (age < 1 || age > 120) return null;
          return (
            <p className="text-xs text-slate">
              Born {new Date(dob).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })} · {age} years old
            </p>
          );
        })()}
      </div>

      {/* Dietary restrictions */}
      <div className="bg-white rounded-[14px] border border-cream-border p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate uppercase tracking-wide">Dietary restrictions</h2>
          <p className="text-xs text-slate mt-1">Claude will never suggest meals that break these.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {DIETARY_RESTRICTIONS.map((r) => (
            <label key={r} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                name="dietary_restrictions"
                value={r}
                defaultChecked={dietaryRestrictions.includes(r)}
                className="w-4 h-4 rounded border-cream-border text-flame focus:ring-flame"
              />
              <span className="text-sm text-charcoal capitalize group-hover:text-charcoal">
                {r}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Diet types */}
      <div className="bg-white rounded-[14px] border border-cream-border p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate uppercase tracking-wide">Diet plan</h2>
          <p className="text-xs text-slate mt-1">Claude will suggest meals that match your diet.</p>
        </div>
        <input type="hidden" name="diet_types" value={JSON.stringify(selectedDietTypes)} />
        <div className="flex flex-wrap gap-2">
          {DIET_TYPES.map((key) => {
            const active = selectedDietTypes.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleDietType(key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  active ? "bg-herb text-white" : "bg-cream text-charcoal hover:bg-cream-dark"
                }`}
              >
                {DIET_TYPE_LABELS[key as keyof typeof DIET_TYPE_LABELS]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Calorie tracking */}
      <div className="bg-white rounded-[14px] border border-cream-border p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate uppercase tracking-wide">Calorie tracking</h2>
          <p className="text-xs text-slate mt-1">Optional — shows calorie totals on your meal plan.</p>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="track_calories"
            value="true"
            checked={caloriesEnabled}
            onChange={(e) => setCaloriesEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-cream-border text-flame focus:ring-flame"
          />
          <span className="text-sm text-charcoal">Track calories for me</span>
        </label>
        {caloriesEnabled && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate">Daily calorie target</label>
            <input
              name="daily_calorie_target"
              type="number"
              min={500}
              max={10000}
              defaultValue={dailyCalorieTarget ?? ""}
              placeholder="e.g. 2000"
              className={inputClass + " max-w-xs"}
            />
          </div>
        )}
      </div>

      {/* Allergies */}
      <div className="bg-white rounded-[14px] border border-cream-border p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate uppercase tracking-wide">Allergies</h2>
          <p className="text-xs text-slate mt-1">Serious allergies — recipes with these will be flagged.</p>
        </div>
        <input type="hidden" name="allergies" value={JSON.stringify(allergyList)} />
        <TagInput
          values={allergyList}
          onChange={setAllergyList}
          placeholder="e.g. peanuts, shellfish, gluten…"
          chipClass="bg-red-100 text-red-700"
        />
      </div>

      {/* Cuisine preferences */}
      <div className="bg-white rounded-[14px] border border-cream-border p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate uppercase tracking-wide">Favourite cuisines</h2>
          <p className="text-xs text-slate mt-1">Claude will favour these when suggesting meals.</p>
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
                    ? "bg-flame text-white"
                    : "bg-cream text-charcoal hover:bg-cream-dark"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Liked ingredients */}
      <div className="bg-white rounded-[14px] border border-cream-border p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate uppercase tracking-wide">Favourite ingredients</h2>
          <p className="text-xs text-slate mt-1">Claude will try to include these in suggestions.</p>
        </div>
        <input type="hidden" name="liked_ingredients" value={JSON.stringify(likedList)} />
        <TagInput
          values={likedList}
          onChange={setLikedList}
          placeholder="e.g. chicken, avo, sweet potato…"
          chipClass="bg-herb-light text-herb"
        />
      </div>

      {/* Ingredient dislikes */}
      <div className="bg-white rounded-[14px] border border-cream-border p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate uppercase tracking-wide">Ingredients to avoid</h2>
          <p className="text-xs text-slate mt-1">Meals with these ingredients won&apos;t be suggested.</p>
        </div>
        <input type="hidden" name="ingredient_dislikes" value={JSON.stringify(dislikes)} />
        <TagInput
          values={dislikes}
          onChange={setDislikes}
          placeholder="e.g. mushrooms, liver, olives…"
          chipClass="bg-flame-light text-flame-dark"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-flame hover:bg-flame-dark disabled:opacity-60 text-white font-semibold py-3 rounded-full text-sm transition-colors"
      >
        {pending ? "Saving…" : "Save preferences"}
      </button>
    </form>
  );
}
