import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDayLog } from "./actions";
import { FoodLogClient, type LibraryRecipe } from "./FoodLogClient";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function FoodLogPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
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

  const day = /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ? (date as string) : todayISO();

  const log = await getDayLog(day);

  // Library for the "add from your recipes" picker (manual + saved global)
  const [{ data: manual }, { data: links }] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, title, calories_per_serving")
      .eq("family_id", membership.family_id)
      .eq("is_global", false),
    supabase
      .from("family_recipes")
      .select("recipe:recipes(id, title, calories_per_serving)")
      .eq("family_id", membership.family_id),
  ]);
  const seen = new Set<string>();
  const library: LibraryRecipe[] = [
    ...((manual ?? []) as LibraryRecipe[]),
    ...(links ?? []).map((l) => l.recipe as unknown as LibraryRecipe),
  ]
    .filter((r) => r && r.id && !seen.has(r.id) && seen.add(r.id))
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 py-4">
        <h1 className="text-2xl font-display font-medium text-flame">Food diary</h1>
      </div>
      <div className="max-w-3xl mx-auto px-4 pb-8">
        {"error" in log ? (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{log.error}</p>
        ) : (
          <FoodLogClient
            key={day}
            date={day}
            today={todayISO()}
            entries={log.entries}
            target={log.target}
            trackCalories={log.trackCalories}
            library={library}
          />
        )}
      </div>
    </main>
  );
}
