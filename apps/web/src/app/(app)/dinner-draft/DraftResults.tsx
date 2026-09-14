import type { DraftResult } from "@nomnate/shared";
export function DraftResults({ result, participants, candidates, finalised }: { finalised: boolean; result: DraftResult; participants: number; candidates: { id: string; recipe: { title: string } }[] }) {
  const title = (id: string) => candidates.find(c => c.id === id)?.recipe.title ?? "Dinner idea";
  return <section aria-label="Draft results" className="rounded-2xl border border-cream-border bg-white p-5 space-y-3">
    <h2 className="font-display text-xl">{finalised ? "Dinner winner" : !result.voteCount ? "Waiting for the family" : result.tied ? "Too close to call" : "Family favourite"}</h2>
    <p>{participants} family member{participants === 1 ? "" : "s"} participating</p>
    {result.voteCount > 0 && result.tied && <p>It’s a tie: {result.tiedCandidateIds.map(title).join(" / ")}. Ask the family to react or change their reactions.</p>}
    {result.winner && <p>{finalised ? "Winner" : "Current leader"}: <strong>{title(result.winner)}</strong></p>}
    <ul className="space-y-2">{result.scores.map(s => <li key={s.candidateId} className="flex justify-between gap-4"><span>{title(s.candidateId)}</span><strong>{s.score}</strong></li>)}</ul>
  </section>;
}
