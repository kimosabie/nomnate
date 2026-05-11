"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GeneratedRecipe = {
  title: string;
  description: string;
  servings: number;
  prep_time: number;
  cook_time: number;
  calories_per_serving: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  cuisine: string | null;
  ingredients: { name: string; quantity: number | null; unit: string | null }[];
  instructions: string[];
  serving_suggestion: string | null;
  cooking_tips: string | null;
  fun_fact: string | null;
};

export type ChefResponse = {
  message: string;
  recipe: GeneratedRecipe | null;
  error: string | null;
};

const COUNTRY_STORES: Record<string, string> = {
  ZA: "Woolworths, Pick n Pay, and Checkers Sixty60",
  UK: "Waitrose, Sainsbury's, and M&S Food",
  FR: "Auchan, Carrefour, Monoprix, and Lidl",
};

const COUNTRY_STORE_GUIDANCE: Record<string, string> = {
  ZA: `  → Use SA product names and brands (e.g. "Woolworths free-range chicken", "PnP free-range eggs")
  → Suggest Sixty60 for quick delivery of staples`,
  UK: `  → Suggest UK equivalents for SA ingredients
  → e.g. "boerewors available at Woolworths UK or make your own with pork/beef mince"
  → Note SA products available at UK stores (Woolworths UK stocks boerewors, biltong, rooibos)`,
  FR: `  → Suggest French equivalents for SA ingredients
  → e.g. "use merguez sausage as a boerewors alternative from Carrefour"
  → Note any SA imports available (rooibos at Monoprix, biltong at specialist stores)`,
};

function buildSystemPrompt(country: string): string {
  const stores = COUNTRY_STORES[country] ?? COUNTRY_STORES.ZA;
  const storeGuidance = COUNTRY_STORE_GUIDANCE[country] ?? COUNTRY_STORE_GUIDANCE.ZA;
  const firstStore = stores.split(",")[0].trim();

  return `You are NomNate's AI Chef for a South African family. ALL families using NomNate are South African — those living in South Africa and SA expats living abroad.

Always suggest South African recipes and embrace SA food culture regardless of which country this family lives in.

This family shops in ${country === "ZA" ? "South Africa" : country === "UK" ? "the United Kingdom" : "France"}. Suggest ingredients available at their local stores (${stores}):
${storeGuidance}

When a user first messages you:
- If they've given you enough detail (servings, time available, dietary needs), generate the recipe right away.
- If not, ask 2–3 brief, warm clarifying questions (servings? dietary restrictions? how long do you have?).

When generating a recipe:
- Use the generate_recipe tool to output structured recipe data.
- Provide a warm, encouraging 1–2 sentence intro in your text response.
- Include FULL detailed step-by-step instructions (minimum 8 steps, no abbreviations).
- Suggest where to buy key ingredients (e.g. "available at ${firstStore}").
- Draw inspiration from SA classics: bobotie, braai, potjie, malva pudding, Cape Malay curry, Durban curry, boerewors, koeksisters, vetkoek, peri-peri chicken.
- Consider children and the whole family in your suggestions.
- End your recipe suggestion with a fun SA food fact or cooking tip.
- This recipe will be disclosed as "Created by NomNate AI Chef (powered by Claude, Anthropic)".

Be warm, practical, and encouraging. Celebrate SA food culture in every response. Never include personal information in your responses.`;
}

const GENERATE_RECIPE_TOOL: Anthropic.Tool = {
  name: "generate_recipe",
  description: "Output structured recipe data once you have enough information from the user.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string", description: "Recipe name" },
      description: { type: "string", description: "1-2 sentence appetising description" },
      servings: { type: "number" },
      prep_time: { type: "number", description: "Prep time in minutes" },
      cook_time: { type: "number", description: "Cook time in minutes" },
      calories_per_serving: { type: "number" },
      protein_g: { type: "number" },
      carbs_g: { type: "number" },
      fat_g: { type: "number" },
      cuisine: { type: "string" },
      ingredients: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string" },
          },
          required: ["name"],
        },
      },
      instructions: {
        type: "array",
        items: { type: "string" },
        description: "Step-by-step instructions, minimum 8 steps",
      },
      serving_suggestion: { type: "string" },
      cooking_tips: { type: "string" },
      fun_fact: { type: "string" },
    },
    required: ["title", "description", "servings", "prep_time", "cook_time", "ingredients", "instructions"],
  },
};

export async function chatWithChef(messages: ChatMessage[]): Promise<ChefResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { message: "", recipe: null, error: "AI Chef is not configured." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let country = "ZA";
  if (user) {
    const { data: m } = await supabase
      .from("family_members")
      .select("families(country)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    country = (m?.families as { country?: string } | null)?.country ?? "ZA";
  }

  const systemPrompt = buildSystemPrompt(country);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: systemPrompt,
      tools: [GENERATE_RECIPE_TOOL],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "generate_recipe"
    );
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");

    if (toolUse && response.stop_reason === "tool_use") {
      // Claude wants to generate a recipe — send tool result back to get final text
      const followUp = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        system: systemPrompt,
        tools: [GENERATE_RECIPE_TOOL],
        messages: [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "assistant" as const, content: response.content },
          {
            role: "user" as const,
            content: [{ type: "tool_result" as const, tool_use_id: toolUse.id, content: "Recipe generated." }],
          },
        ],
      });
      const finalText = followUp.content.find((b): b is Anthropic.TextBlock => b.type === "text");
      return {
        message: finalText?.text ?? "Here's your recipe!",
        recipe: toolUse.input as GeneratedRecipe,
        error: null,
      };
    }

    if (toolUse) {
      return {
        message: textBlock?.text ?? "Here's your recipe!",
        recipe: toolUse.input as GeneratedRecipe,
        error: null,
      };
    }

    return { message: textBlock?.text ?? "", recipe: null, error: null };
  } catch (err) {
    console.error("AI Chef error:", err);
    return { message: "", recipe: null, error: "The AI Chef is temporarily unavailable. Please try again." };
  }
}

export async function saveChefRecipe(recipe: GeneratedRecipe): Promise<{ id: string | null; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { id: null, error: "Not authenticated" };

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return { id: null, error: "No family found" };

  const { data: saved, error } = await supabase
    .from("recipes")
    .insert({
      title: recipe.title,
      description: recipe.description,
      source: "ai" as const,
      source_attribution: "Created by NomNate AI Chef (powered by Claude, Anthropic)",
      family_id: membership.family_id,
      is_global: false,
      servings: recipe.servings,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      cuisine: recipe.cuisine ?? null,
      calories_per_serving: recipe.calories_per_serving ?? null,
      protein_g: recipe.protein_g ?? null,
      carbs_g: recipe.carbs_g ?? null,
      fat_g: recipe.fat_g ?? null,
      instructions: recipe.instructions.map((s, i) => `${i + 1}. ${s}`).join("\n"),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !saved) return { id: null, error: error?.message ?? "Failed to save recipe" };

  if (recipe.ingredients.length > 0) {
    await supabase.from("recipe_ingredients").insert(
      recipe.ingredients.map((ing) => ({
        recipe_id: saved.id,
        name: ing.name,
        quantity: ing.quantity ?? null,
        unit: ing.unit ?? null,
      }))
    );
  }

  revalidatePath("/recipes");
  return { id: saved.id, error: null };
}
