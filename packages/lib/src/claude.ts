import Anthropic from "@anthropic-ai/sdk";
import type { MealSuggestionParams, SuggestedRecipe } from "@nomnate/types";

// Only call server-side (Next.js API routes / Edge Functions)
const client = new Anthropic();

export async function suggestMeals(
  params: MealSuggestionParams
): Promise<SuggestedRecipe[]> {
  const {
    familySize,
    dietaryRestrictions,
    cuisinePreferences = [],
    ingredientDislikes = [],
    cuisine,
    excludeTitles = [],
    count = 7,
  } = params;

  const restrictions =
    dietaryRestrictions.length > 0
      ? `Dietary restrictions for the family: ${dietaryRestrictions.join(", ")}.`
      : "No specific dietary restrictions.";

  const preferences =
    cuisinePreferences.length > 0
      ? `The family enjoys these cuisines: ${cuisinePreferences.join(", ")}. Favour these where possible.`
      : "";

  const dislikes =
    ingredientDislikes.length > 0
      ? `Avoid these ingredients — family members dislike them: ${ingredientDislikes.join(", ")}.`
      : "";

  const exclusions =
    excludeTitles.length > 0
      ? `Do not suggest these meals (already in the plan): ${excludeTitles.join(", ")}.`
      : "";

  const prompt = `You are a helpful meal planning assistant for a South African family.

Suggest ${count} dinner recipes for a family of ${familySize}.
${restrictions}
${preferences}
${dislikes}
${cuisine ? `Preferred cuisine style: ${cuisine}.` : ""}
${exclusions}

Return ONLY a valid JSON array with this exact structure, no other text:
[
  {
    "title": "Recipe name",
    "cuisine": "e.g. Italian, South African, Asian",
    "prep_time": 30,
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
- Instructions should be practical and clear
- Use ingredients commonly available in South Africa`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

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
