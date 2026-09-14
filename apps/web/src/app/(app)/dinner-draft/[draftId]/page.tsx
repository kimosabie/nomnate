import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { dinnerDateLabel } from "@nomnate/shared";
import { loadDinnerDraft } from "@/lib/dinnerDraft";
import { DraftExperience } from "../DraftExperience";
export default async function DinnerDraftPage({ params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(draftId)) notFound();
  let experience;
  try { experience = await loadDinnerDraft(draftId); }
  catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") redirect("/login");
    if (error instanceof Error && error.message === "No active family") redirect("/onboarding");
    throw error;
  }
  if (!experience) notFound();
  const date = experience.candidates[0]?.target_date;
  return <main className="max-w-3xl mx-auto px-4 py-8 space-y-5"><Link href={date ? `/tonight?date=${date}` : "/tonight"} className="text-flame">← Tonight</Link>
    <h1 className="text-3xl font-display">Dinner Draft</h1>{date && <p className="text-slate">{dinnerDateLabel(date)}</p>}
    <DraftExperience experience={experience} />
  </main>;
}
