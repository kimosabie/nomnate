import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Parses raw instructions (HTML from Spoonacular or plain text from Claude)
// into an ordered array of step strings.
function parseInstructions(raw: string): string[] {
  const s = raw.trim();
  if (!s) return [];

  // HTML path — extract text from <li> elements (Spoonacular format)
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
    // Fallback: strip all tags and return as single paragraph
    const stripped = s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return stripped ? [stripped] : [];
  }

  // Plain text path — numbered list on separate lines: "1. ...\n2. ..."
  const lines = s.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1 && lines.every((l) => /^\d+[.)]\s/.test(l))) {
    return lines.map((l) => l.replace(/^\d+[.)]\s+/, "").trim());
  }

  // Numbered steps mixed with continuation lines — split on line-initial numbers
  const byNumber = s
    .split(/\n(?=\d+[.)]\s)/)
    .map((chunk) => chunk.replace(/^\d+[.)]\s+/, "").trim())
    .filter(Boolean);
  if (byNumber.length > 1) return byNumber;

  // Double-newline separated paragraphs
  if (s.includes("\n\n")) {
    return s.split(/\n\n+/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean);
  }

  // Single-newline separated lines
  if (lines.length > 1) return lines;

  // Single block of text
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

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, title, image_url, prep_time, cuisine, source, instructions")
    .eq("id", id)
    .eq("family_id", membership.family_id)
    .maybeSingle();

  if (!recipe) notFound();

  const { data: ingredients } = await supabase
    .from("recipe_ingredients")
    .select("id, name, quantity, unit")
    .eq("recipe_id", id);

  const steps = recipe.instructions ? parseInstructions(recipe.instructions) : [];

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link
            href="/recipes"
            className="text-gray-400 hover:text-gray-700 text-lg leading-none transition-colors"
            aria-label="Back to recipes"
          >
            &#8592;
          </Link>
          <span className="text-xl font-bold text-orange-500 truncate">
            {recipe.title}
          </span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {recipe.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.image_url}
            alt={recipe.title}
            className="w-full h-56 object-cover rounded-2xl"
          />
        )}

        {/* Meta */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h1 className="text-xl font-bold text-gray-900">{recipe.title}</h1>

          {/* Stats row */}
          {(recipe.prep_time || steps.length > 0) && (
            <div className="flex gap-6 mt-4">
              {recipe.prep_time && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Total time</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {recipe.prep_time} min
                  </p>
                </div>
              )}
              {steps.length > 1 && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Steps</p>
                  <p className="text-sm font-semibold text-gray-900">{steps.length}</p>
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mt-4">
            {recipe.cuisine && (
              <span className="text-xs bg-gray-100 text-gray-600 font-medium px-3 py-1 rounded-full">
                {recipe.cuisine}
              </span>
            )}
            <span className="text-xs bg-gray-100 text-gray-500 font-medium px-3 py-1 rounded-full">
              {recipe.source === "ai" ? "AI suggested" : recipe.source}
            </span>
          </div>
        </div>

        {/* Ingredients */}
        {ingredients && ingredients.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Ingredients ({ingredients.length})
            </h2>
            <ul className="space-y-2">
              {ingredients.map((ing) => (
                <li
                  key={ing.id}
                  className="flex items-start gap-2.5 text-sm text-gray-700"
                >
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                  <span>
                    {ing.quantity != null
                      ? `${ing.quantity}${ing.unit ? ` ${ing.unit}` : ""} ${ing.name}`
                      : ing.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Instructions */}
        {steps.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-5">
              Method
            </h2>

            {steps.length === 1 ? (
              <p className="text-sm text-gray-700 leading-relaxed">{steps[0]}</p>
            ) : (
              <ol className="space-y-5">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-4">
                    <div className="shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </div>
                    <p className="flex-1 text-sm text-gray-700 leading-relaxed">
                      {step}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
