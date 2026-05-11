import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DIET_TYPE_LABELS } from "@nomnate/types";

function toMetric(
  quantity: number | null,
  unit: string | null
): { qty: number | null; unit: string | null } {
  if (quantity == null || !unit) return { qty: quantity, unit };
  const u = unit.toLowerCase().trim();
  if (u === "oz" || u === "ounce" || u === "ounces") {
    const g = Math.round(quantity * 28.35);
    return g >= 1000 ? { qty: Math.round(g / 100) / 10, unit: "kg" } : { qty: g, unit: "g" };
  }
  if (u === "lb" || u === "lbs" || u === "pound" || u === "pounds") {
    const g = Math.round(quantity * 453.6);
    return g >= 1000 ? { qty: Math.round(g / 100) / 10, unit: "kg" } : { qty: g, unit: "g" };
  }
  if (u === "fl oz" || u === "fluid ounce" || u === "fluid ounces") {
    return { qty: Math.round(quantity * 29.574), unit: "ml" };
  }
  if (u === "cup" || u === "cups") {
    const ml = quantity * 250;
    return { qty: Number.isInteger(ml) ? ml : Math.round(ml * 10) / 10, unit: "ml" };
  }
  if (u === "gallon" || u === "gallons" || u === "gal") {
    return { qty: Math.round(quantity * 3.785 * 10) / 10, unit: "l" };
  }
  return { qty: quantity, unit };
}

function parseInstructions(raw: string): string[] {
  const s = raw.trim();
  if (!s) return [];

  if (/<li/i.test(s)) {
    const steps: string[] = [];
    const re = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let m;
    while ((m = re.exec(s)) !== null) {
      const text = m[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .replace(/&#?\w+;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) steps.push(text);
    }
    if (steps.length > 0) return steps;
    const stripped = s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return stripped ? [stripped] : [];
  }

  const lines = s.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1 && lines.every((l) => /^\d+[.)]\s/.test(l))) {
    return lines.map((l) => l.replace(/^\d+[.)]\s+/, "").trim());
  }

  const byNumber = s
    .split(/\n(?=\d+[.)]\s)/)
    .map((chunk) => chunk.replace(/^\d+[.)]\s+/, "").trim())
    .filter(Boolean);
  if (byNumber.length > 1) return byNumber;

  if (s.includes("\n\n")) {
    return s.split(/\n\n+/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean);
  }

  if (lines.length > 1) return lines;

  return [s];
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  // Global recipes have family_id = null — query without family_id filter,
  // access is controlled by RLS (global readable + family_id readable to members)
  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, title, description, image_url, image_attribution, prep_time, cook_time, servings, cuisine, source, source_url, source_attribution, instructions, diet_types, calories_per_serving, protein_g, carbs_g, fat_g, is_global, family_id")
    .eq("id", id)
    .maybeSingle();

  // Verify access: global recipe OR belongs to this family
  if (!recipe) notFound();
  if (!recipe.is_global && recipe.family_id !== membership.family_id) notFound();

  const { data: ingredients } = await supabase
    .from("recipe_ingredients")
    .select("id, name, quantity, unit")
    .eq("recipe_id", id);

  const steps = recipe.instructions ? parseInstructions(recipe.instructions) : [];

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 py-4">
        <Link
          href="/recipes"
          className="inline-flex items-center gap-1 text-sm text-slate hover:text-charcoal transition-colors mb-3"
        >
          ← Recipes
        </Link>
        <h1 className="text-2xl font-display font-medium text-flame leading-tight">
          {recipe.title}
        </h1>
        {recipe.description && (
          <p className="text-sm text-slate mt-1 leading-relaxed">{recipe.description}</p>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-8 space-y-4">
        {recipe.image_url && (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={recipe.image_url}
              alt={recipe.title}
              className="w-full h-56 object-cover rounded-[14px]"
            />
            {(recipe as { image_attribution?: string | null }).image_attribution && (
              <p className="text-xs text-slate/50 text-right mt-1 px-1">
                {(recipe as { image_attribution?: string | null }).image_attribution}
              </p>
            )}
          </div>
        )}

        {/* Meta */}
        <div className="bg-white rounded-[14px] border border-cream-border p-6">
          {(recipe.prep_time || recipe.cook_time || recipe.servings || steps.length > 0) && (
            <div className="flex flex-wrap gap-6">
              {recipe.prep_time && (
                <div>
                  <p className="text-xs text-slate mb-0.5">Prep time</p>
                  <p className="text-sm font-semibold text-charcoal">{recipe.prep_time} min</p>
                </div>
              )}
              {recipe.cook_time && (
                <div>
                  <p className="text-xs text-slate mb-0.5">Cook time</p>
                  <p className="text-sm font-semibold text-charcoal">{recipe.cook_time} min</p>
                </div>
              )}
              {recipe.servings && (
                <div>
                  <p className="text-xs text-slate mb-0.5">Servings</p>
                  <p className="text-sm font-semibold text-charcoal">{recipe.servings}</p>
                </div>
              )}
              {steps.length > 1 && (
                <div>
                  <p className="text-xs text-slate mb-0.5">Steps</p>
                  <p className="text-sm font-semibold text-charcoal">{steps.length}</p>
                </div>
              )}
            </div>
          )}

          {/* Macro strip */}
          {recipe.calories_per_serving != null && (
            <div className="flex gap-4 mt-4 bg-cream rounded-xl px-4 py-3">
              <div className="text-center">
                <p className="text-base font-bold text-charcoal">{recipe.calories_per_serving}</p>
                <p className="text-xs text-slate">kcal</p>
              </div>
              {recipe.protein_g != null && (
                <div className="text-center">
                  <p className="text-base font-bold text-charcoal">{recipe.protein_g}g</p>
                  <p className="text-xs text-slate">protein</p>
                </div>
              )}
              {recipe.carbs_g != null && (
                <div className="text-center">
                  <p className="text-base font-bold text-charcoal">{recipe.carbs_g}g</p>
                  <p className="text-xs text-slate">carbs</p>
                </div>
              )}
              {recipe.fat_g != null && (
                <div className="text-center">
                  <p className="text-base font-bold text-charcoal">{recipe.fat_g}g</p>
                  <p className="text-xs text-slate">fat</p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            {recipe.cuisine && (
              <span className="text-xs bg-turmeric-light text-turmeric-dark font-medium px-3 py-1 rounded-full">
                {recipe.cuisine}
              </span>
            )}
            <span className="text-xs bg-flame-light text-flame-dark font-medium px-3 py-1 rounded-full">
              {recipe.source === "ai" ? "AI suggested" : recipe.source === "manual" ? "Your recipe" : recipe.source === "prescribed" ? "Prescribed" : recipe.source}
            </span>
            {((recipe.diet_types as string[]) ?? []).map((d) => (
              <span key={d} className="text-xs bg-herb-light text-herb font-medium px-3 py-1 rounded-full">
                {DIET_TYPE_LABELS[d as keyof typeof DIET_TYPE_LABELS] ?? d}
              </span>
            ))}
          </div>
        </div>

        {/* Ingredients */}
        {ingredients && ingredients.length > 0 && (
          <div className="bg-white rounded-[14px] border border-cream-border p-6">
            <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-4">
              Ingredients ({ingredients.length})
            </p>
            <ul className="space-y-2">
              {ingredients.map((ing) => (
                <li
                  key={ing.id}
                  className="flex items-start gap-2.5 text-sm text-charcoal"
                >
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-flame shrink-0" />
                  <span>
                    {(() => {
                      const { qty, unit: u } = toMetric(ing.quantity, ing.unit);
                      return qty != null
                        ? `${qty}${u ? ` ${u}` : ""} ${ing.name}`
                        : ing.name;
                    })()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Instructions */}
        {steps.length > 0 && (
          <div className="bg-white rounded-[14px] border border-cream-border p-6">
            <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-5">
              Method
            </p>

            {steps.length === 1 ? (
              <p className="text-sm text-charcoal leading-relaxed">{steps[0]}</p>
            ) : (
              <ol className="space-y-5">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-4">
                    <div className="shrink-0 w-6 h-6 rounded-full bg-flame-light text-flame-dark text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </div>
                    <p className="flex-1 text-sm text-charcoal leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* Source attribution */}
        {(recipe.source_attribution || recipe.source_url) && (
          <p className="text-xs text-slate/60 text-center leading-relaxed px-2">
            {recipe.source_attribution}
            {recipe.source_url && (
              <>
                {" · "}
                <a
                  href={recipe.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-slate"
                >
                  View original
                </a>
              </>
            )}
          </p>
        )}
      </div>
    </main>
  );
}
