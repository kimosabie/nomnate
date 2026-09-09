/** Phase 1: one draft is one decision; weekly orchestration can compose contests later. */
export const REACTION_WEIGHTS = { love: 3, eat: 1, whatever: 0, nope: -3 } as const;
export type DraftReaction = keyof typeof REACTION_WEIGHTS;
export type DraftStatus = "open" | "finalised" | "cancelled";
export type DraftType = "tonight" | "weekly";
export interface ScoringCandidate { id: string }
export interface ScoringVote {
  candidateId: string;
  familyMemberId: string;
  reaction: DraftReaction;
}
export interface CandidateScore {
  candidateId: string;
  score: number;
  voteCount: number;
  reactions: Record<DraftReaction, number>;
}
export interface DraftResult {
  winner: string | null;
  scores: CandidateScore[];
  voteCount: number;
  tied: boolean;
  tiedCandidateIds: string[];
}

/** Stable ID ordering is presentation only. It never breaks a tie. */
export function scoreDraft(candidates: readonly ScoringCandidate[], votes: readonly ScoringVote[]): DraftResult {
  const scores = new Map<string, CandidateScore>();
  for (const candidate of candidates) {
    if (!candidate.id || scores.has(candidate.id)) throw new Error("Duplicate or invalid candidate");
    scores.set(candidate.id, { candidateId: candidate.id, score: 0, voteCount: 0,
      reactions: { love: 0, eat: 0, whatever: 0, nope: 0 } });
  }
  const seen = new Set<string>();
  for (const vote of votes) {
    const candidate = scores.get(vote.candidateId);
    if (!candidate) throw new Error("Vote references an unknown candidate");
    if (!vote.familyMemberId || !Object.hasOwn(REACTION_WEIGHTS, vote.reaction)) throw new Error("Invalid vote");
    const key = JSON.stringify([vote.candidateId, vote.familyMemberId]);
    if (seen.has(key)) throw new Error("Duplicate vote for member and candidate");
    seen.add(key);
    candidate.score += REACTION_WEIGHTS[vote.reaction];
    candidate.voteCount++;
    candidate.reactions[vote.reaction]++;
  }
  const ordered = [...scores.values()].sort((a, b) => a.candidateId < b.candidateId ? -1 : a.candidateId > b.candidateId ? 1 : 0);
  const best = Math.max(...ordered.map((s) => s.score));
  const leaders = ordered.filter((s) => s.score === best).map((s) => s.candidateId);
  return {
    winner: votes.length > 0 && leaders.length === 1 ? leaders[0] : null,
    scores: ordered,
    voteCount: votes.length,
    tied: leaders.length > 1,
    tiedCandidateIds: leaders.length > 1 ? leaders : [],
  };
}

export interface FinalisationDraft {
  id: string;
  familyId: string;
  createdBy: string | null;
  status: DraftStatus;
}
export interface FinalisationMember { userId: string; familyId: string; role: string }

/** The RPC repeats these checks under a lock; the service alone is not a security boundary. */
export function assertCanFinalise(
  userId: string,
  activeFamilyId: string,
  member: FinalisationMember | null,
  draft: FinalisationDraft,
): void {
  if (!userId || !member || member.userId !== userId) throw new Error("Not authenticated as this member");
  if (member.familyId !== activeFamilyId || draft.familyId !== activeFamilyId) throw new Error("Draft is outside your active family");
  if (draft.createdBy !== userId && member.role !== "admin") throw new Error("Only the planner or a family admin can finalise");
  if (draft.status !== "open") throw new Error("Draft is not open");
}

export function requireDraftWinner(result: DraftResult): string {
  if (!result.scores.length) throw new Error("Draft has no candidates");
  if (!result.voteCount) throw new Error("Draft has no votes");
  if (result.tied) throw new Error("Draft has an unresolved tie");
  if (!result.winner) throw new Error("Draft has no winner");
  return result.winner;
}

export interface MealCommitment { status: string; committed_draft_id?: string | null }
export function assertMutableMeal(slot: MealCommitment): void {
  if (slot.status === "confirmed" || slot.committed_draft_id) {
    throw new Error("This meal is committed. It cannot be changed or reset in Phase 1.");
  }
}

/** Persist only a checked winner intent; the transaction must rescore under its own lock. */
export async function finaliseDraftWith<T>(
  input: { userId: string; activeFamilyId: string; member: FinalisationMember | null;
    draft: FinalisationDraft; candidates: readonly ScoringCandidate[]; votes: readonly ScoringVote[] },
  commit: (intent: { draft_id: string; expected_winner: string }) => Promise<T>,
): Promise<T> {
  assertCanFinalise(input.userId, input.activeFamilyId, input.member, input.draft);
  const winner = requireDraftWinner(scoreDraft(input.candidates, input.votes));
  return commit({ draft_id: input.draft.id, expected_winner: winner });
}
