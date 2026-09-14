"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { loadDinnerDraft } from "@/lib/dinnerDraft";
import { CandidateCard } from "./CandidateCard";
import { ReactionButtons } from "./ReactionButtons";
import { DraftResults } from "./DraftResults";
import { finishDinnerDraft, reactToDinnerCandidate } from "./actions";
export function DraftExperience({ experience }: { experience: NonNullable<Awaited<ReturnType<typeof loadDinnerDraft>>> }) {
  const { draft, candidates, result, canManage, isOpen, participants } = experience;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const date = candidates[0]?.target_date;
  function run(action: () => Promise<{ error?: string } | undefined>) {
    setError(null);
    startTransition(async () => {
      try { const response = await action(); if (response?.error) setError(response.error); }
      catch { setError("Could not update the draft. Please refresh and try again."); }
      router.refresh();
    });
  }
  return <div className="space-y-5">
    {!isOpen && <p role="status">{draft.status === "finalised" ? "Dinner is decided." : draft.status === "cancelled" ? "This draft was cancelled." : "This draft has expired."} <Link className="text-flame underline" href={date ? `/tonight?date=${date}` : "/tonight"}>Go to Tonight</Link></p>}
    {error && <p role="alert" className="rounded-xl border border-flame bg-white p-4">{error}</p>}
    <button type="button" onClick={() => router.refresh()} disabled={pending} className="text-flame underline">Refresh reactions</button>
    <div className="grid gap-4 sm:grid-cols-2">{candidates.map(candidate => <CandidateCard key={candidate.id} recipe={candidate.recipe} recipeId={candidate.recipe_id}>
      <ReactionButtons recipeTitle={candidate.recipe.title} reaction={candidate.reaction} disabled={pending || !isOpen} onReact={reaction => run(() => reactToDinnerCandidate(draft.id, candidate.id, reaction))} />
    </CandidateCard>)}</div>
    {canManage && <DraftResults finalised={draft.status === "finalised"} result={result} participants={participants} candidates={candidates} />}
    {canManage && isOpen && result.winner && <button disabled={pending} onClick={() => run(() => finishDinnerDraft(draft.id, result.winner!))} className="w-full rounded-xl bg-flame p-3 font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Finalise dinner"}</button>}
  </div>;
}
