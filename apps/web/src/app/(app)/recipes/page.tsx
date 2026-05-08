import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RecipeSearch } from "./RecipeSearch";
import { toggleFavourite } from "./actions";

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

  const { data: recipes } = await supabase
    .from("recipes")
    .select(
      "id, title, image_url, prep_time, cuisine, is_favourite, source, created_by"
    )
    .eq("family_id", membership.family_id)
    .order("is_favourite", { ascending: false })
    .order("created_at", { ascending: false });

  const favourites = recipes?.filter((r) => r.is_favourite) ?? [];
  const rest = recipes?.filter((r) => !r.is_favourite) ?? [];

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
          <RecipeSearch familyId={membership.family_id} />
        </div>

        {/* Saved recipes */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Family recipes ({recipes?.length ?? 0})
          </h2>

          {!recipes?.length ? (
            <p className="text-sm text-gray-400 text-center py-8">
              No recipes saved yet — search above to add some
            </p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {[...favourites, ...rest].map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <Link href={`/recipes/${r.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    {r.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.image_url}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-orange-50 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {r.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {[
                          r.prep_time ? `${r.prep_time} min` : null,
                          r.cuisine,
                          !r.prep_time && !r.cuisine ? "Spoonacular" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </Link>
                  {r.created_by === user.id ? (
                    <form action={toggleFavourite} className="shrink-0 flex items-center">
                      <input type="hidden" name="recipeId" value={r.id} />
                      <input
                        type="hidden"
                        name="isFavourite"
                        value={String(r.is_favourite)}
                      />
                      <button
                        type="submit"
                        title={
                          r.is_favourite
                            ? "Remove from favourites"
                            : "Add to favourites"
                        }
                        className={`text-xl shrink-0 transition-transform hover:scale-110 leading-none ${
                          r.is_favourite ? "text-orange-400" : "text-gray-300"
                        }`}
                      >
                        &#9733;
                      </button>
                    </form>
                  ) : (
                    <span
                      className={`text-xl shrink-0 leading-none ${
                        r.is_favourite ? "text-orange-400" : "text-gray-200"
                      }`}
                    >
                      &#9733;
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
