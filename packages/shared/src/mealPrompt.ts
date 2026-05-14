// =====================================================================
// packages/shared/src/mealPrompt.ts
// =====================================================================
// Builds the system prompt sent to Claude for meal suggestions.
// Replaces the hardcoded SA prompt with dynamic localisation.
// =====================================================================

import {
  COUNTRIES,
  CUISINE_LABELS,
  DIETARY_LABELS,
  type CountryCode,
  type Cuisine,
  type DietaryRequirement,
} from './localisation';

export interface FamilyMealContext {
  country: CountryCode;
  cuisinePreferences: Cuisine[];
  dietaryRequirements: DietaryRequirement[];
  familySize: number;
  /** Last N meals so Claude avoids repetition. Optional. */
  recentMeals?: string[];
  /** Allergies as free text from onboarding, e.g. ["peanuts", "shellfish"] */
  allergies?: string[];
}

export interface MealSuggestionRequest {
  family: FamilyMealContext;
  /** How many meal options to generate */
  count?: number;
}

export function buildMealSystemPrompt(family: FamilyMealContext): string {
  const country = COUNTRIES[family.country];
  const storeNames = country.stores.map(s => s.name).join(', ');

  const cuisines = family.cuisinePreferences.length
    ? family.cuisinePreferences.map(c => CUISINE_LABELS[c]).join(', ')
    : 'no strong preference — surprise the family';

  const dietary = family.dietaryRequirements.length
    ? family.dietaryRequirements.map(d => DIETARY_LABELS[d]).join(', ')
    : 'none';

  const allergies = family.allergies?.length
    ? family.allergies.join(', ')
    : 'none reported';

  const recent = family.recentMeals?.length
    ? `\nRecently eaten (DO NOT repeat): ${family.recentMeals.slice(0, 10).join(', ')}`
    : '';

  return `You are the meal-suggestion assistant for NomNate, a family meal voting app.

FAMILY CONTEXT
- Location: ${country.name}
- Family size: ${family.familySize}
- Preferred cuisines: ${cuisines}
- Dietary requirements: ${dietary}
- Allergies: ${allergies}
- Local grocery stores: ${storeNames}
- Measurement system: ${country.unitSystem}${recent}

RULES — read carefully, these are non-negotiable
1. STRICTLY honour every dietary requirement.
   - "halal"      → no pork, no alcohol-based dishes, only halal-permissible meat.
   - "kosher"     → follow kosher rules (no pork/shellfish, no meat+dairy together).
   - "vegetarian" → no meat, no fish.
   - "vegan"      → no animal products at all.
   - "pescatarian"→ no meat, fish is fine.
   - "gluten_free", "dairy_free", "nut_free" → exclude the relevant ingredients entirely.
   - "low_carb"   → keep carbs minimal (no pasta, rice, potato mains).
2. STRICTLY avoid any listed allergens.
3. Use ingredients that are realistically available at the listed grocery stores.
4. Use ${country.unitSystem} measurements (g, kg, ml, l, °C).
5. If multiple cuisines are listed, ROTATE — do not suggest the same cuisine every time.
6. Keep all suggestions suitable for children.
7. Suggestions should be achievable on a weeknight (under ~45 min) unless the family asks for a project meal.

OUTPUT FORMAT
Respond ONLY with a JSON array of meal objects. No preamble, no markdown fences, no commentary.

[
  {
    "name": "string",
    "cuisine": "string (one of the family's preferred cuisines)",
    "description": "one sentence, friendly tone",
    "estimatedTimeMinutes": number,
    "mainIngredients": ["string", ...],
    "suitableFor": ["adults", "kids"] | ["adults"]
  }
]`;
}

/**
 * Convenience wrapper for the actual Claude API call.
 * Plug into your existing Anthropic client.
 */
export function buildMealUserPrompt(req: MealSuggestionRequest): string {
  const count = req.count ?? 5;
  return `Suggest ${count} dinner ideas for tonight, following all rules in the system prompt. Return JSON only.`;
}
