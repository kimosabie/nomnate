import "server-only";
import { guessNutrition } from "@nomnate/lib/spoonacular";
import { estimateNutrition } from "@nomnate/lib/claude";

export type EstimatedNutrition = {
  calories_per_serving: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  nutrition_estimated: true;
};

// Estimate per-serving nutrition for a recipe: Spoonacular guessNutrition first,
// Claude as a fallback. Returns null if neither produces a figure. Always flagged
// estimated so the UI can show it as approximate. Only the title + ingredient
// names leave our server (no PII).
export async function estimateRecipeNutrition(
  title: string,
  ingredients: string[] = []
): Promise<EstimatedNutrition | null> {
  const key = process.env.SPOONACULAR_API_KEY;
  if (key && title.trim()) {
    try {
      const g = await guessNutrition(title, key);
      if (g) return { ...g, nutrition_estimated: true };
    } catch {
      /* fall through to AI */
    }
  }
  const ai = await estimateNutrition({ title, ingredients });
  return ai ? { ...ai, nutrition_estimated: true } : null;
}
