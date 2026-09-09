export interface ShoppingSlot {
  id: string;
  day_of_week: number;
  course: string;
  option_number: number;
  recipe_id: string | null;
  status: string;
  committed_draft_id?: string | null;
}
export interface ShoppingIngredient { recipe_id: string; name: string; quantity: number | null; unit: string | null }

/** Preserve legacy plans; authoritative commitments always take priority over option order. */
export function selectShoppingRecipes(slots: readonly ShoppingSlot[]): string[] {
  const groups = new Map<string, ShoppingSlot[]>();
  for (const slot of slots) {
    if (!slot.recipe_id) continue;
    const key = JSON.stringify([slot.day_of_week, slot.course]);
    groups.set(key, [...(groups.get(key) ?? []), slot]);
  }
  return [...groups.values()].map((group) => {
    const committed = group.filter((s) => s.committed_draft_id);
    if (committed.length > 1) throw new Error("Multiple committed meals for one day and course");
    if (committed.length) {
      if (committed[0].status !== "confirmed") throw new Error("Invalid committed meal status");
      return committed[0].recipe_id!;
    }
    const confirmed = group.filter((s) => s.status === "confirmed");
    if (confirmed.length > 1) throw new Error("Multiple confirmed meals for one day and course");
    return (confirmed[0] ?? [...group].sort((a, b) => a.option_number - b.option_number)[0]).recipe_id!;
  });
}

/** Expand each occurrence, not each unique recipe; events use the same scaling rule. */
export function scaleShoppingIngredients(
  recipeOccurrences: readonly string[],
  recipes: readonly { id: string; servings: number | null }[],
  ingredients: readonly ShoppingIngredient[],
  people: number,
): { name: string; quantity: number | null; unit: string | null }[] {
  if (!Number.isFinite(people) || people <= 0) throw new Error("Invalid serving count");
  const servings = new Map(recipes.map((r) => [r.id, r.servings && r.servings > 0 ? r.servings : 4]));
  return recipeOccurrences.flatMap((id) => {
    if (!servings.has(id)) throw new Error("A selected recipe is unavailable");
    const factor = people / servings.get(id)!;
    return ingredients.filter((i) => i.recipe_id === id).map((i) => ({
      name: i.name, quantity: i.quantity == null ? null : Math.round(i.quantity * factor * 100) / 100, unit: i.unit,
    }));
  });
}
