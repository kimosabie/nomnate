import Anthropic from "@anthropic-ai/sdk";
import { buildMealSystemPrompt, type CountryCode, type Cuisine, type DietaryRequirement } from "@nomnate/shared";
import type { FamilyMemberContext, MealSuggestionParams, SuggestedRecipe } from "@nomnate/types";
import { DIET_TYPE_LABELS } from "@nomnate/types";

const client = new Anthropic();

function buildMemberLines(members: FamilyMemberContext[]): string[] {
  return members.map((m) => {
    const who = m.relationship
      ? m.relationship.charAt(0).toUpperCase() + m.relationship.slice(1)
      : "Family member";
    const agePart = m.age ? `, ${m.age}` : "";
    const parts: string[] = [];
    if (m.dietaryRestrictions.length > 0) parts.push(m.dietaryRestrictions.join(", "));
    if (m.allergies.length > 0) parts.push(`allergic to ${m.allergies.join(", ")}`);
    if (m.dietTypes.length > 0) {
      const labels = m.dietTypes.map((d) => DIET_TYPE_LABELS[d as keyof typeof DIET_TYPE_LABELS] ?? d);
      parts.push(labels.join(", "));
    }
    if (m.calorieTarget) parts.push(`~${m.calorieTarget} kcal/day`);
    const details = parts.length > 0 ? ` — ${parts.join("; ")}` : " — no restrictions";
    return `- ${who}${agePart}${details}`;
  });
}

// Cheap per-serving nutrition estimate (Haiku) — fallback when Spoonacular can't
// estimate. Sends only the dish title + ingredient names (no PII). Returns null on failure.
export async function estimateNutrition(input: {
  title: string;
  ingredients?: string[];
}): Promise<{ calories_per_serving: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null } | null> {
  const ing = input.ingredients?.length ? `\nIngredients: ${input.ingredients.join(", ")}.` : "";
  const prompt = `Estimate the per-serving nutrition for this dish. Reply ONLY with compact JSON {"calories":N,"protein_g":N,"carbs_g":N,"fat_g":N} as integers (grams for macros).\nDish: ${input.title}.${ing}`;
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const json = JSON.parse(text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, ""));
    if (typeof json.calories !== "number") return null;
    const intOrNull = (v: unknown) => (typeof v === "number" ? Math.round(v) : null);
    return {
      calories_per_serving: Math.round(json.calories),
      protein_g: intOrNull(json.protein_g),
      carbs_g: intOrNull(json.carbs_g),
      fat_g: intOrNull(json.fat_g),
    };
  } catch {
    return null;
  }
}

function buildFallbackContext(
  familySize: number,
  dietaryRestrictions: string[],
  dietTypes: string[],
  calorieTarget?: number | null
): string {
  const parts: string[] = [];
  if (dietaryRestrictions.length > 0)
    parts.push(`Dietary restrictions: ${dietaryRestrictions.join(", ")}.`);
  if (dietTypes.length > 0)
    parts.push(`Diet plans: ${dietTypes.map((d) => DIET_TYPE_LABELS[d as keyof typeof DIET_TYPE_LABELS] ?? d).join(", ")}.`);
  if (calorieTarget)
    parts.push(`Target approximately ${calorieTarget} calories per serving.`);
  return parts.length > 0 ? parts.join("\n") : `No specific dietary restrictions for this family of ${familySize}.`;
}

export async function suggestMeals(
  params: MealSuggestionParams
): Promise<SuggestedRecipe[]> {
  const {
    familySize,
    dietaryRestrictions,
    cuisinePreferences = [],
    ingredientDislikes = [],
    likedIngredients = [],
    dietTypes = [],
    calorieTarget,
    cuisine,
    excludeTitles = [],
    count = 7,
    familyMembers = [],
    country,
    familyDietaryRequirements = [],
    course,
  } = params;

  // What kind of dish to ask for (defaults to dinner mains)
  const COURSE_NOUNS: Record<string, string> = {
    starter: "starter / appetiser",
    main: "dinner main-course",
    dessert: "dessert",
    side: "side dish",
  };
  const dishNoun = (course && COURSE_NOUNS[course]) || "dinner";
  const courseInstruction =
    course === "dessert"
      ? "Every suggestion must be a dessert (sweet course)."
      : course === "starter"
      ? "Every suggestion must be a starter / appetiser, not a main."
      : course === "side"
      ? "Every suggestion must be a side dish."
      : "";

  const systemPrompt = country
    ? buildMealSystemPrompt({
        country: country as CountryCode,
        cuisinePreferences: cuisinePreferences as Cuisine[],
        dietaryRequirements: familyDietaryRequirements as DietaryRequirement[],
        familySize,
      })
    : undefined;

  const preferences =
    cuisinePreferences.length > 0
      ? `The family enjoys these cuisines: ${cuisinePreferences.join(", ")}. Favour these where possible.`
      : "";

  const dislikes =
    ingredientDislikes.length > 0
      ? `Avoid these ingredients — family members dislike them: ${ingredientDislikes.join(", ")}.`
      : "";

  const liked =
    likedIngredients.length > 0
      ? `Try to include these favourite ingredients where suitable: ${likedIngredients.join(", ")}.`
      : "";

  const exclusions =
    excludeTitles.length > 0
      ? `Do not suggest these meals (already in the plan): ${excludeTitles.join(", ")}.`
      : "";

  const memberLines = buildMemberLines(familyMembers);
  const familyContext = memberLines.length > 0
    ? `Family composition:\n${memberLines.join("\n")}`
    : buildFallbackContext(familySize, dietaryRestrictions, dietTypes, calorieTarget);

  const locationFallback = systemPrompt
    ? ""
    : "- Use ingredients commonly available in the family's region";

  const prompt = `${systemPrompt ? "" : "You are a helpful meal planning assistant.\n\n"}Suggest ${count} ${dishNoun} recipes for a family of ${familySize}.
${courseInstruction}
${familyContext}
${preferences}
${dislikes}
${liked}
${cuisine ? `Preferred cuisine style: ${cuisine}.` : ""}
${exclusions}

Return ONLY a valid JSON array with this exact structure, no other text:
[
  {
    "title": "Recipe name",
    "cuisine": "e.g. Italian, South African, Asian",
    "prep_time": 30,
    "calories_per_serving": 450,
    "protein_g": 28,
    "carbs_g": 40,
    "fat_g": 15,
    "instructions": "Clear step-by-step instructions...",
    "ingredients": [
      { "name": "ingredient name", "quantity": 2, "unit": "cups" }
    ]
  }
]

Rules:
- prep_time is total time in minutes
- quantity can be null if it's e.g. "salt to taste"
- unit can be null for countable items like "eggs"
- calories_per_serving, protein_g, carbs_g, fat_g are estimates — provide reasonable values
- Instructions should be practical and clear
${locationFallback}`.trimEnd();

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: [{ role: "user", content: prompt }],
  });

  if (!message.content.length) {
    throw new Error("AI returned an empty response — try again");
  }
  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("AI returned an unexpected response — try again");

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("AI returned malformed JSON — try again");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("AI returned no recipes — try again");
  }

  return parsed as SuggestedRecipe[];
}
