import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
          <h1 className="text-xl font-bold text-gray-900 mb-3">{recipe.title}</h1>
          <div className="flex flex-wrap gap-2">
            {recipe.prep_time && (
              <span className="text-xs bg-orange-50 text-orange-700 font-medium px-3 py-1 rounded-full">
                {recipe.prep_time} min
              </span>
            )}
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
                <li key={ing.id} className="flex items-start gap-2.5 text-sm text-gray-700">
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
        {recipe.instructions && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Instructions
            </h2>
            <div
              className="text-sm text-gray-700 leading-relaxed [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_li]:leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0"
              dangerouslySetInnerHTML={{ __html: recipe.instructions }}
            />
          </div>
        )}
      </div>
    </main>
  );
}
