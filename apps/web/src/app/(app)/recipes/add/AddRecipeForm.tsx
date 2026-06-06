"use client";

import { useActionState, useRef, useState } from "react";
import { addManualRecipe } from "./actions";
import { DIET_TYPES, DIET_TYPE_LABELS, CUISINES, SELECTABLE_COURSES, COURSE_LABELS } from "@nomnate/types";

const inputClass =
  "w-full px-4 py-2.5 border border-cream-border rounded-xl text-sm text-charcoal placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent";

type Ingredient = { id: string; name: string; quantity: string; unit: string };
type Step = { id: string; text: string };

function uid() {
  return Math.random().toString(36).slice(2);
}

export function AddRecipeForm() {
  const [error, action, pending] = useActionState(addManualRecipe, null);

  const ingredientsJsonRef = useRef<HTMLInputElement>(null);
  const stepsJsonRef = useRef<HTMLInputElement>(null);

  const [dietTypes, setDietTypes] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: uid(), name: "", quantity: "", unit: "" },
  ]);
  const [steps, setSteps] = useState<Step[]>([{ id: uid(), text: "" }]);

  function toggleDiet(key: string) {
    setDietTypes((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
    );
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, { id: uid(), name: "", quantity: "", unit: "" }]);
  }

  function removeIngredient(id: string) {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  }

  function updateIngredient(id: string, field: keyof Omit<Ingredient, "id">, value: string) {
    setIngredients((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  }

  function addStep() {
    setSteps((prev) => [...prev, { id: uid(), text: "" }]);
  }

  function removeStep(id: string) {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }

  function updateStep(id: string, text: string) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
  }

  function handleSubmit() {
    if (ingredientsJsonRef.current) {
      ingredientsJsonRef.current.value = JSON.stringify(
        ingredients.filter((i) => i.name.trim()).map(({ name, quantity, unit }) => ({
          name,
          quantity: quantity || null,
          unit: unit || null,
        }))
      );
    }
    if (stepsJsonRef.current) {
      stepsJsonRef.current.value = JSON.stringify(
        steps.filter((s) => s.text.trim()).map((s) => s.text)
      );
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}

      {/* Hidden serialised fields */}
      <input type="hidden" name="ingredients_json" ref={ingredientsJsonRef} />
      <input type="hidden" name="steps_json" ref={stepsJsonRef} />
      {dietTypes.map((d) => (
        <input key={d} type="hidden" name="diet_types" value={d} />
      ))}

      {/* Basic info */}
      <div className="bg-white rounded-[14px] border border-cream-border p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate uppercase tracking-wide">Basic info</h2>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate">Recipe name *</label>
          <input name="title" type="text" required placeholder="e.g. Bobotie" className={inputClass} />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate">Description</label>
          <textarea
            name="description"
            rows={2}
            placeholder="Short description…"
            className={inputClass + " resize-none"}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate">Cuisine</label>
            <select name="cuisine" className={inputClass}>
              <option value="">Select…</option>
              {CUISINES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate">Course</label>
            <select name="course" defaultValue="main" className={inputClass}>
              {SELECTABLE_COURSES.map((c) => (
                <option key={c} value={c}>{COURSE_LABELS[c]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate">Servings</label>
            <input name="servings" type="number" min={1} max={100} placeholder="4" className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate">Prep time (min)</label>
            <input name="prep_time" type="number" min={0} placeholder="15" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate">Cook time (min)</label>
            <input name="cook_time" type="number" min={0} placeholder="30" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate">Calories / serving</label>
            <input name="calories_per_serving" type="number" min={0} placeholder="450" className={inputClass} />
          </div>
        </div>
      </div>

      {/* Diet types */}
      <div className="bg-white rounded-[14px] border border-cream-border p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate uppercase tracking-wide">Diet types</h2>
        <div className="flex flex-wrap gap-2">
          {DIET_TYPES.map((key) => {
            const active = dietTypes.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleDiet(key)}
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

      {/* Image */}
      <div className="bg-white rounded-[14px] border border-cream-border p-6 space-y-3">
        <h2 className="text-sm font-semibold text-slate uppercase tracking-wide">Photo (optional)</h2>
        <input
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-sm text-slate file:mr-3 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-flame-light file:text-flame hover:file:bg-cream-dark"
        />
        <p className="text-xs text-slate">Max 5 MB · JPG, PNG or WebP</p>
      </div>

      {/* Ingredients */}
      <div className="bg-white rounded-[14px] border border-cream-border p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate uppercase tracking-wide">Ingredients</h2>

        <div className="space-y-3">
          {ingredients.map((ing, idx) => (
            <div key={ing.id} className="bg-cream rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate">Ingredient {idx + 1}</span>
                {ingredients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeIngredient(ing.id)}
                    className="text-xs text-slate hover:text-red-500 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>

              <input
                type="text"
                placeholder="Ingredient name (e.g. chicken thighs)"
                value={ing.name}
                onChange={(e) => updateIngredient(ing.id, "name", e.target.value)}
                className={inputClass}
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Quantity (e.g. 500)"
                  value={ing.quantity}
                  onChange={(e) => updateIngredient(ing.id, "quantity", e.target.value)}
                  className={inputClass}
                />
                <input
                  type="text"
                  placeholder="Unit (e.g. g, cups, tbsp)"
                  value={ing.unit}
                  onChange={(e) => updateIngredient(ing.id, "unit", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addIngredient}
          className="text-sm font-medium text-flame hover:text-flame-dark transition-colors"
        >
          + Add ingredient
        </button>
      </div>

      {/* Steps */}
      <div className="bg-white rounded-[14px] border border-cream-border p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate uppercase tracking-wide">Instructions</h2>

        <div className="space-y-3">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex gap-3 items-start">
              <div className="shrink-0 w-6 h-6 rounded-full bg-flame-light text-flame-dark text-xs font-bold flex items-center justify-center mt-2.5">
                {idx + 1}
              </div>
              <textarea
                rows={2}
                placeholder={`Step ${idx + 1}…`}
                value={step.text}
                onChange={(e) => updateStep(step.id, e.target.value)}
                className={inputClass + " flex-1 resize-none"}
              />
              {steps.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeStep(step.id)}
                  className="shrink-0 text-slate hover:text-red-400 transition-colors text-lg leading-none mt-2.5"
                  aria-label="Remove step"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addStep}
          className="text-sm font-medium text-flame hover:text-flame-dark transition-colors"
        >
          + Add step
        </button>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-flame hover:bg-flame-dark disabled:opacity-60 text-white font-semibold py-3 rounded-full text-sm transition-colors"
      >
        {pending ? "Saving…" : "Save recipe"}
      </button>
    </form>
  );
}
