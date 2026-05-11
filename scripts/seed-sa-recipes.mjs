/**
 * NomNate — SA Recipe Seeder
 * Uses Claude (with web_search) to find real recipes from credible SA food websites,
 * then saves them to the global recipe library with proper attribution.
 *
 * Usage:
 *   node scripts/seed-sa-recipes.mjs
 *
 * Requires env vars (copy from .env.local):
 *   ANTHROPIC_API_KEY
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   UNSPLASH_ACCESS_KEY  (optional — used as image fallback)
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../apps/web/.env.local") });

const require = createRequire(import.meta.url);
const Anthropic = require("@anthropic-ai/sdk");
const { createClient } = require("@supabase/supabase-js");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SA_DISHES = [
  "Bobotie",
  "Braai boerewors",
  "Bunny chow",
  "Lamb potjiekos",
  "Vetkoek with mince",
  "Malva pudding",
  "Pap en sous",
  "Cape Malay chicken curry",
  "Milk tart",
  "Sosaties",
  "Biltong pasta",
  "Braaibroodjies",
  "Snoek braai",
  "Oxtail stew",
  "Koeksisters",
  "Chakalaka",
  "Durban curry",
  "Chicken livers peri-peri",
  "Boereboontjies",
];

const SA_SOURCES = [
  "taste.co.za",
  "drizzleanddip.com",
  "food24.com",
  "woolworths.co.za/recipes",
  "checkers.co.za/recipes",
];

const RECIPE_TOOL = {
  name: "save_recipe",
  description: "Save the extracted recipe data in structured form",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      source_site: { type: "string", description: "e.g. Taste.co.za" },
      source_url: { type: "string", description: "Full URL of the original recipe page" },
      image_url: { type: "string", description: "Image URL from the source page if available" },
      prep_time: { type: "number", description: "Minutes" },
      cook_time: { type: "number", description: "Minutes" },
      servings: { type: "number" },
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
        description: "Full step-by-step instructions, minimum 5 detailed steps",
      },
    },
    required: ["title", "source_site", "source_url", "ingredients", "instructions"],
  },
};

async function getUnsplashImage(query) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query + " south african food")}&per_page=1&orientation=landscape&client_id=${key}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const photo = data.results?.[0];
    if (!photo) return null;
    return {
      imageUrl: photo.urls.regular,
      imageAttribution: `Photo by ${photo.user.name} on Unsplash`,
    };
  } catch {
    return null;
  }
}

async function seedDish(dish) {
  console.log(`\n→ ${dish}`);

  // Check if already seeded as web_reference
  const { data: existing } = await supabase
    .from("recipes")
    .select("id, source")
    .ilike("title", dish)
    .eq("is_global", true)
    .maybeSingle();

  if (existing?.source === "web_reference") {
    console.log(`  ✓ already seeded (web_reference)`);
    return;
  }

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 8000,
      tools: [
        { type: "web_search_20250305", name: "web_search" },
        RECIPE_TOOL,
      ],
      messages: [
        {
          role: "user",
          content: `Find a detailed, authentic recipe for "${dish}" from one of these South African food websites: ${SA_SOURCES.join(", ")}.

Extract the FULL recipe including:
- Exact ingredient list with quantities and units
- Complete step-by-step cooking instructions (minimum 5 detailed steps, not abbreviated)
- Prep time and cook time in minutes
- Number of servings
- The exact source URL and website name
- Any photograph URL visible on the page

Use the save_recipe tool to output the structured data. If you can't find it on those sites, search for it on any credible South African food website.`,
        },
      ],
    });

    // Find the save_recipe tool use block
    let recipeData = null;
    for (const block of response.content) {
      if (block.type === "tool_use" && block.name === "save_recipe") {
        recipeData = block.input;
        break;
      }
    }

    // If tool not called yet (web_search still running), continue conversation
    if (!recipeData && response.stop_reason === "tool_use") {
      // Find web_search calls and process them
      const toolResults = [];
      for (const block of response.content) {
        if (block.type === "tool_use" && block.name === "web_search") {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: "Search completed.",
          });
        }
      }

      if (toolResults.length > 0) {
        const followUp = await client.messages.create({
          model: "claude-opus-4-5",
          max_tokens: 8000,
          tools: [
            { type: "web_search_20250305", name: "web_search" },
            RECIPE_TOOL,
          ],
          messages: [
            {
              role: "user",
              content: `Find and extract the full recipe for "${dish}" from a credible SA food website. Use the save_recipe tool.`,
            },
            { role: "assistant", content: response.content },
            { role: "user", content: toolResults },
          ],
        });

        for (const block of followUp.content) {
          if (block.type === "tool_use" && block.name === "save_recipe") {
            recipeData = block.input;
            break;
          }
        }
      }
    }

    if (!recipeData) {
      console.log(`  ✗ Claude did not return recipe data`);
      return;
    }

    console.log(`  Found: "${recipeData.title}" from ${recipeData.source_site}`);
    console.log(`  URL: ${recipeData.source_url}`);
    console.log(`  Steps: ${recipeData.instructions?.length ?? 0}`);

    // Get image — prefer source page image, fall back to Unsplash
    let imageUrl = recipeData.image_url ?? null;
    let imageAttribution = null;
    if (!imageUrl) {
      const unsplash = await getUnsplashImage(dish);
      if (unsplash) {
        imageUrl = unsplash.imageUrl;
        imageAttribution = unsplash.imageAttribution;
        console.log(`  Image: Unsplash fallback`);
      }
    } else {
      console.log(`  Image: from source`);
    }

    const instructionsText = (recipeData.instructions ?? [])
      .map((s, i) => `${i + 1}. ${s}`)
      .join("\n");

    if (existing) {
      // Update existing AI-generated recipe
      const { error } = await supabase
        .from("recipes")
        .update({
          title: recipeData.title,
          source: "web_reference",
          source_url: recipeData.source_url,
          source_attribution: `Recipe by ${recipeData.source_site} — ${recipeData.source_url}`,
          image_url: imageUrl,
          image_attribution: imageAttribution,
          prep_time: recipeData.prep_time ?? null,
          cook_time: recipeData.cook_time ?? null,
          servings: recipeData.servings ?? null,
          instructions: instructionsText,
          cuisine: "South African",
          is_global: true,
        })
        .eq("id", existing.id);

      if (error) {
        console.log(`  ✗ Update failed: ${error.message}`);
        return;
      }

      // Replace ingredients
      await supabase.from("recipe_ingredients").delete().eq("recipe_id", existing.id);
      if ((recipeData.ingredients ?? []).length > 0) {
        await supabase.from("recipe_ingredients").insert(
          recipeData.ingredients.map((ing) => ({
            recipe_id: existing.id,
            name: ing.name,
            quantity: ing.quantity ?? null,
            unit: ing.unit ?? null,
          }))
        );
      }
      console.log(`  ✓ Updated (replaced AI recipe)`);
    } else {
      // Insert new global recipe
      const { data: saved, error } = await supabase
        .from("recipes")
        .insert({
          title: recipeData.title,
          source: "web_reference",
          source_url: recipeData.source_url,
          source_attribution: `Recipe by ${recipeData.source_site} — ${recipeData.source_url}`,
          image_url: imageUrl,
          image_attribution: imageAttribution,
          prep_time: recipeData.prep_time ?? null,
          cook_time: recipeData.cook_time ?? null,
          servings: recipeData.servings ?? null,
          instructions: instructionsText,
          cuisine: "South African",
          is_global: true,
          family_id: null,
        })
        .select("id")
        .single();

      if (error || !saved) {
        console.log(`  ✗ Insert failed: ${error?.message}`);
        return;
      }

      if ((recipeData.ingredients ?? []).length > 0) {
        await supabase.from("recipe_ingredients").insert(
          recipeData.ingredients.map((ing) => ({
            recipe_id: saved.id,
            name: ing.name,
            quantity: ing.quantity ?? null,
            unit: ing.unit ?? null,
          }))
        );
      }
      console.log(`  ✓ Inserted (${recipeData.ingredients?.length ?? 0} ingredients)`);
    }
  } catch (err) {
    console.log(`  ✗ Error: ${err.message}`);
  }

  // Rate-limit courtesy pause between dishes
  await new Promise((r) => setTimeout(r, 2000));
}

console.log("NomNate SA Recipe Seeder");
console.log("========================");
console.log(`Seeding ${SA_DISHES.length} SA classics via Claude web search\n`);

for (const dish of SA_DISHES) {
  await seedDish(dish);
}

console.log("\n✓ Done");
