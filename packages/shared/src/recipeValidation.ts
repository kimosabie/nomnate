export interface ValidatedRecipe {
  title: string;
  cuisine: string;
  prep_time: number;
  cook_time?: number;
  servings?: number;
  instructions: string;
  calories_per_serving?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  ingredients: { name: string; quantity: number | null; unit: string | null }[];
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AI recipe must be an object");
  return value as Record<string, unknown>;
}
function text(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("Invalid AI recipe " + field);
  return value.trim();
}
function number(value: unknown, field: string, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) throw new Error("Invalid AI recipe " + field);
  return value;
}

function integer(value: unknown, field: string, max: number): number {
  const result = number(value, field, max);
  if (!Number.isInteger(result)) throw new Error("Invalid AI recipe " + field + ": expected a whole number");
  return result;
}

/** Reject malformed model output before any recipe/ingredient writes occur. */
export function validateGeneratedRecipes(value: unknown, maxCount = 7): ValidatedRecipe[] {
  if (!Array.isArray(value) || !value.length || value.length > maxCount) throw new Error("Invalid AI recipe count");
  const titles = new Set<string>();
  return value.map((raw) => {
    const r = object(raw);
    const title = text(r.title, "title", 200);
    if (titles.has(title.toLowerCase())) throw new Error("Duplicate AI recipe title");
    titles.add(title.toLowerCase());
    if (!Array.isArray(r.ingredients) || !r.ingredients.length || r.ingredients.length > 100) throw new Error("Invalid AI recipe ingredients");
    const recipe: ValidatedRecipe = {
      title,
      cuisine: text(r.cuisine, "cuisine", 100),
      prep_time: integer(r.prep_time, "prep_time", 1440),
      instructions: text(r.instructions, "instructions", 20000),
      ingredients: r.ingredients.map((rawIngredient) => {
        const i = object(rawIngredient);
        return {
          name: text(i.name, "ingredient name", 200),
          quantity: i.quantity == null ? null : number(i.quantity, "ingredient quantity", 100000),
          unit: i.unit == null || i.unit === "" ? null : text(i.unit, "ingredient unit", 100),
        };
      }),
    };
    for (const field of ["calories_per_serving", "protein_g", "carbs_g", "fat_g"] as const) {
      if (r[field] != null) recipe[field] = integer(r[field], field, 100000);
    }
    if (r.cook_time != null) recipe.cook_time = integer(r.cook_time, "cook_time", 1440);
    if (r.servings != null) {
      recipe.servings = integer(r.servings, "servings", 1000);
      if (recipe.servings === 0) throw new Error("Invalid AI recipe servings");
    }
    return recipe;
  });
}

export function parseGeneratedRecipes(response: string, maxCount = 7): ValidatedRecipe[] {
  const cleaned = response.trim().replace(/^\x60\x60\x60(?:json)?\s*/i, "").replace(/\s*\x60\x60\x60$/, "");
  let value: unknown;
  try { value = JSON.parse(cleaned); } catch { throw new Error("AI returned malformed JSON"); }
  return validateGeneratedRecipes(value, maxCount);
}
