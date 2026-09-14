import Link from "next/link";
import { redirect } from "next/navigation";
import { householdToday, validDinnerDate, dinnerWeek, dinnerDateLabel } from "@nomnate/shared";
import { dinnerContext, snapshotDisplay, draftIsOpen } from "@/lib/dinnerDraft";
import { StartDinnerDraftForm } from "../dinner-draft/StartDinnerDraftForm";
import { CandidateCard } from "../dinner-draft/CandidateCard";
export default async function TonightPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  let context;
  try { context = await dinnerContext(); } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") redirect("/login");
    if (error instanceof Error && error.message === "No active family") redirect("/onboarding");
    throw error;
  }
  const { supabase, familyId } = context;
  const { data: family, error } = await supabase.from("families").select("timezone").eq("id", familyId).single();
  if (error) throw error;
  const requested = (await searchParams).date;
  const date = validDinnerDate(requested) ? requested : householdToday(family.timezone);
  const { weekStart, dayOfWeek } = dinnerWeek(date);
  const { data: plan, error: planError } = await supabase.from("meal_plans").select("id").eq("family_id", familyId).eq("week_start_date", weekStart).maybeSingle();
  if (planError) throw planError;
  const { data: slots, error: slotError } = plan ? await supabase.from("meal_plan_slots")
    .select("recipe_id, committed_draft_id, recipes(title, image_url, description, prep_time, cook_time, cuisine)")
    .eq("meal_plan_id", plan.id).eq("day_of_week", dayOfWeek).eq("course", "main").eq("status", "confirmed")
    : { data: [], error: null };
  if (slotError) throw slotError;
  const committed = slots?.find(s => s.committed_draft_id) ?? slots?.[0];
  const { data: candidates, error: candidatesError } = await supabase.from("draft_candidates")
    .select("draft_id, recipe_id, recipe_snapshot, dinner_drafts!draft_candidates_draft_id_fkey!inner(id, family_id, status, draft_type, expires_at, created_at)")
    .eq("target_date", date).eq("course", "main").eq("dinner_drafts.family_id", familyId).eq("dinner_drafts.draft_type", "tonight");
  if (candidatesError) throw candidatesError;
  const open = candidates?.filter(c => draftIsOpen(c.dinner_drafts))
    .sort((a, b) => a.dinner_drafts.created_at.localeCompare(b.dinner_drafts.created_at))[0];
  const snapshot = committed && candidates?.find(c => c.draft_id === committed.committed_draft_id && c.recipe_id === committed.recipe_id);
  const recipe = committed?.recipes ?? (snapshot ? snapshotDisplay(snapshot.recipe_snapshot) : null);
  return <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
    <p className="text-slate">{dinnerDateLabel(date)}</p>
    {requested && !validDinnerDate(requested) && <p role="alert">That date wasn’t valid. Showing today instead.</p>}
    <h1 className="font-display text-3xl">{committed ? "Tonight’s winner" : open ? "Dinner Draft in progress" : "What’s for dinner?"}</h1>
    {committed ? <>{recipe ? <CandidateCard recipe={recipe} recipeId={committed.recipe_id} /> : <p>Your dinner is committed.</p>}<Link href="/meal-plan" className="block text-flame underline">View meal plan</Link></>
      : open ? <Link href={`/dinner-draft/${open.draft_id}`} className="block rounded-xl bg-flame p-3 text-center font-semibold text-white">Join the Draft</Link>
      : <StartDinnerDraftForm key={date} date={date} />}
  </main>;
}
