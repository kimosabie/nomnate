// Ingredient consolidation for shopping lists: unit normalisation, compound
// splitting, and same-unit / volume / weight summing. Shared by the meal-plan
// and event shopping lists.

const UNIT_ALIASES: Record<string, string> = {
  // Weight
  gram: "g", grams: "g",
  kilogram: "kg", kilograms: "kg",
  ounce: "oz", ounces: "oz",
  pound: "lb", pounds: "lb",
  // Volume
  milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml",
  liter: "l", liters: "l", litre: "l", litres: "l",
  tablespoon: "tbsp", tablespoons: "tbsp", tbs: "tbsp", tbsps: "tbsp",
  teaspoon: "tsp", teaspoons: "tsp", tsps: "tsp",
  cups: "cup",
  // Count
  cloves: "clove",
  pieces: "piece",
  cans: "can",
  slices: "slice",
  // Discard (no meaningful unit for shopping)
  whole: "", leaves: "", leaf: "", pods: "", pod: "",
  medium: "", large: "", small: "",
  stalks: "", stalk: "", sprigs: "", sprig: "",
  heads: "", head: "", bunches: "", bunch: "",
  serving: "", servings: "",  // scraped serving-count artifacts
};

// Units that signal "no quantity" — item is just listed as needed
const NO_QTY_UNITS = new Set(["to taste", "as needed", "for serving", "to garnish", "to season", "for greasing"]);

// Conversion factors to base units
const VOLUME_ML: Record<string, number> = { tsp: 5, tbsp: 15, cup: 240, ml: 1, l: 1000 };
const WEIGHT_G: Record<string, number> = { g: 1, kg: 1000, oz: 28.35, lb: 453.6 };

function fromMl(ml: number): { qty: number; unit: string } {
  if (ml >= 500) return { qty: Math.round(ml / 100) / 10, unit: "l" };
  if (ml >= 30) return { qty: Math.round(ml), unit: "ml" };
  if (ml >= 15) return { qty: Math.round((ml / 15) * 10) / 10, unit: "tbsp" };
  return { qty: Math.round((ml / 5) * 10) / 10, unit: "tsp" };
}

function fromG(g: number): { qty: number; unit: string } {
  if (g >= 900) return { qty: Math.round(g / 100) / 10, unit: "kg" };
  return { qty: Math.round(g), unit: "g" };
}

// Strip preparation notes from unit field ("tablespoon, for greasing" → "tablespoon")
function cleanUnit(unit: string | null | undefined): string {
  if (!unit) return "";
  const stripped = unit.split(",")[0].trim().toLowerCase();
  // If the entire unit is a no-qty signal, signal that upstream
  if (NO_QTY_UNITS.has(unit.toLowerCase().trim())) return "__notaste__";
  return UNIT_ALIASES[stripped] ?? stripped;
}

// Known compound ingredients that should always be split into individual items
const COMPOUND_SPLITS: Record<string, string[]> = {
  "salt and pepper": ["salt", "pepper"],
  "salt & pepper": ["salt", "pepper"],
  "salt and black pepper": ["salt", "black pepper"],
  "salt and white pepper": ["salt", "white pepper"],
};

// Expand a raw ingredient into one or more raw ingredients, splitting compounds
function expandIngredient(ing: RawIng): RawIng[] {
  const lower = ing.name.toLowerCase().trim();
  const parts = COMPOUND_SPLITS[lower];
  if (!parts) return [ing];
  // Each split part gets no quantity (they're always "to taste" in this context)
  return parts.map((p) => ({ name: p, quantity: null, unit: null }));
}

// Returns null if the ingredient should be skipped entirely (serving suggestions etc.)
function normalizeIngredientName(name: string): string | null {
  // Skip serving suggestions embedded in the name
  if (/for serving|for garnish|to serve|to garnish/i.test(name)) return null;

  return name
    .replace(/\s*\([^)]*\)/g, "")   // remove parenthetical notes: "butter (for cooking)" → "butter"
    .replace(/,\s*.+$/, "")          // remove prep notes after comma: "butter, softened" → "butter"
    .replace(/\s*\*\d+\s*$/, "")     // remove scaling artifacts: "water *2" → "water"
    .toLowerCase()
    .trim() || null;
}

export type RawIng = { name: string; quantity: number | null; unit: string | null };
export type ConsolidatedItem = { ingredient_name: string; quantity: number | null; unit: string | null };

export function consolidateIngredients(ingredients: RawIng[]): ConsolidatedItem[] {
  // Expand compounds ("salt and pepper" → ["salt", "pepper"]) then group by normalised name
  const expanded = ingredients.flatMap(expandIngredient);
  const groups = new Map<string, { displayName: string; items: RawIng[] }>();
  for (const ing of expanded) {
    const key = normalizeIngredientName(ing.name);
    if (!key) continue; // skip blank names
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(ing);
    } else {
      // Use the shortest clean display name as the label
      groups.set(key, { displayName: key, items: [ing] });
    }
  }

  const result: ConsolidatedItem[] = [];

  for (const [, { displayName, items }] of groups) {
    const normUnits = items.map((i) => cleanUnit(i.unit));

    // Filter out "to taste" entries for quantity purposes; if ALL are "to taste" → no quantity
    const measuredItems = items.filter((_, idx) => normUnits[idx] !== "__notaste__");
    const measuredUnits = normUnits.filter((u) => u !== "__notaste__");

    if (measuredItems.length === 0) {
      // Every entry is "to taste" / unmeasured
      result.push({ ingredient_name: displayName, quantity: null, unit: null });
      continue;
    }

    // All same unit (including "")  → sum
    if (measuredUnits.every((u) => u === measuredUnits[0])) {
      const total = measuredItems.reduce((s, i) => s + (i.quantity ?? 0), 0);
      result.push({
        ingredient_name: displayName,
        quantity: total || null,
        unit: measuredUnits[0] || null,
      });
      continue;
    }

    // All volume → convert to ml, sum, reformat
    if (measuredUnits.every((u) => u in VOLUME_ML)) {
      const totalMl = measuredItems.reduce(
        (s, i, idx) => s + (i.quantity ?? 0) * (VOLUME_ML[measuredUnits[idx]] ?? 1),
        0
      );
      const { qty, unit } = fromMl(totalMl);
      result.push({ ingredient_name: displayName, quantity: qty, unit });
      continue;
    }

    // All weight → convert to g, sum, reformat
    if (measuredUnits.every((u) => u in WEIGHT_G)) {
      const totalG = measuredItems.reduce(
        (s, i, idx) => s + (i.quantity ?? 0) * (WEIGHT_G[measuredUnits[idx]] ?? 1),
        0
      );
      const { qty, unit } = fromG(totalG);
      result.push({ ingredient_name: displayName, quantity: qty, unit });
      continue;
    }

    // Mixed units → keep the entry with the most information
    const withBoth = measuredItems.filter((i, idx) => i.quantity != null && measuredUnits[idx]);
    const rep = withBoth[0] ?? measuredItems.find((i) => i.quantity != null) ?? measuredItems[0];
    const repUnit = cleanUnit(rep.unit);
    result.push({
      ingredient_name: displayName,
      quantity: rep.quantity,
      unit: repUnit && repUnit !== "__notaste__" ? repUnit : null,
    });
  }

  return result.sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name));
}

