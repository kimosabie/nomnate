import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RecipeSearch } from "./RecipeSearch";
import { toggleFavourite } from "./actions";
import { DeleteRecipeButton } from "./DeleteRecipeButton";
import { RecipeListClient } from "./RecipeListClient";

function cuisineEmoji(cuisine: string | null): string {
  if (!cuisine) return "🍽️";
  const c = cuisine.toLowerCase();
  if (c.includes("italian")) return "🍝";
  if (c.includes("south african") || c.includes("braai")) return "🍖";
  if (c.includes("indian")) return "🍛";
  if (c.includes("asian") || c.includes("chinese") || c.includes("japanese") || c.includes("korean")) return "🍜";
  if (c.includes("mexican") || c.includes("tex-mex")) return "🌮";
  if (c.includes("mediterranean") || c.includes("greek")) return "🥗";
  if (c.includes("middle eastern") || c.includes("turkish")) return "🫒";
  if (c.includes("american")) return "🍔";
  if (c.includes("french")) return "🥐";
  if (c.includes("thai")) return "🥢";
  if (c.includes("portuguese")) return "🥩";
  return "🍽️";
}

export default async function RecipesPage() {
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

  const [{ data: recipes }, { data: members }] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, title, image_url, prep_time, cuisine, is_favourite, source, created_by")
      .eq("family_id", membership.family_id)
      .order("is_favourite", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("family_members")
      .select("name, dietary_restrictions, ingredient_dislikes, allergies")
      .eq("family_id", membership.family_id),
  ]);

  // Build conflict map: recipe id → member names with conflicts
  const conflictMap = new Map<string, string[]>();
  const recipeIds = recipes?.map((r) => r.id) ?? [];

  if (recipeIds.length > 0 && members && members.length > 0) {
    const { data: ingredients } = await supabase
      .from("recipe_ingredients")
      .select("recipe_id, name")
      .in("recipe_id", recipeIds);

    if (ingredients) {
      for (const row of ingredients) {
        const ingName = row.name.toLowerCase();
        for (const member of members) {
          const terms = [
            ...((member.allergies as string[]) ?? []),
            ...((member.ingredient_dislikes as string[]) ?? []),
          ];
          if (terms.some((t) => ingName.includes(t.toLowerCase()))) {
            const existing = conflictMap.get(row.recipe_id) ?? [];
            const mName = member.name ?? "A member";
            if (!existing.includes(mName)) {
              conflictMap.set(row.recipe_id, [...existing, mName]);
            }
          }
        }
      }
    }
  }

  const annotated = (recipes ?? []).map((r) => ({
    ...r,
    emoji: cuisineEmoji(r.cuisine),
    conflicts: conflictMap.get(r.id) ?? [],
    isOwner: r.created_by === user.id,
  }));

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-gray-400 hover:text-gray-700 text-lg leading-none transition-colors"
            aria-label="Back to dashboard"
          >
            &#8592;
          </Link>
          <span className="text-xl font-bold text-orange-500">Recipes</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Search */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Find &amp; add recipes
          </h2>
          <RecipeSearch />
        </div>

        {/* Saved recipes */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <RecipeListClient
            recipes={annotated}
            toggleFavourite={toggleFavourite}
          />
        </div>
      </div>
    </main>
  );
}
