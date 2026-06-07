import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEvent } from "../actions";
import { EventDetailClient, type EventLibraryRecipe } from "./EventDetailClient";

export default async function EventDetailPage({
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

  const result = await getEvent(id);
  if ("error" in result) notFound();

  // Library for the add-dish picker (manual + saved global), with course
  const [{ data: manual }, { data: links }] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, title, course")
      .eq("family_id", membership.family_id)
      .eq("is_global", false),
    supabase
      .from("family_recipes")
      .select("recipe:recipes(id, title, course)")
      .eq("family_id", membership.family_id),
  ]);
  const seen = new Set<string>();
  const library: EventLibraryRecipe[] = [
    ...((manual ?? []) as EventLibraryRecipe[]),
    ...(links ?? []).map((l) => l.recipe as unknown as EventLibraryRecipe),
  ]
    .filter((r) => r && r.id && !seen.has(r.id) && seen.add(r.id))
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 py-4">
        <Link
          href="/events"
          className="inline-flex items-center gap-1 text-sm text-slate hover:text-charcoal transition-colors mb-3"
        >
          ← Events
        </Link>
      </div>
      <div className="max-w-3xl mx-auto px-4 pb-8">
        <EventDetailClient event={result.event} dishes={result.dishes} library={library} />
      </div>
    </main>
  );
}
