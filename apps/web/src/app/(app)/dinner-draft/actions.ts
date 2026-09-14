"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { dinnerContext, dinnerError } from "@/lib/dinnerDraft";
import { assertCanFinalise, finaliseDraftWith, REACTION_WEIGHTS, validDinnerDate } from "@nomnate/shared";

export async function finaliseDinnerDraft(draftId: string, expectedWinner?: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" } as const;
  const { data: activeFamilyId, error: activeError } = await supabase.rpc("active_family_id");
  if (activeError || !activeFamilyId) return { error: activeError?.message ?? "No active family" } as const;
  const [{ data: member, error: memberError }, { data: draft, error: draftError }] = await Promise.all([
    supabase.from("family_members").select("user_id, family_id, role")
      .eq("user_id", user.id).eq("family_id", activeFamilyId).maybeSingle(),
    supabase.from("dinner_drafts").select("id, family_id, created_by, status, expires_at").eq("id", draftId).maybeSingle(),
  ]);
  if (memberError || draftError) return { error: memberError?.message ?? draftError!.message } as const;
  if (!draft) return { error: "Draft not found in your active family" } as const;
  try {
    if (draft.expires_at && Date.parse(draft.expires_at) <= Date.now()) throw new Error("Draft has expired; start or join a new Dinner Draft");
    assertCanFinalise(user.id, activeFamilyId,
      member && { userId: member.user_id, familyId: member.family_id, role: member.role },
      { id: draft.id, familyId: draft.family_id, createdBy: draft.created_by, status: draft.status });
    const { data: candidates, error: candidateError } = await supabase.from("draft_candidates")
      .select("id").eq("draft_id", draftId);
    if (candidateError) throw candidateError;
    if (!candidates?.length) throw new Error("Draft has no candidates");
    const { data: votes, error: voteError } = await supabase.from("draft_votes")
      .select("candidate_id, family_member_id, reaction").in("candidate_id", candidates.map((c) => c.id));
    if (voteError) throw voteError;
    const result = await finaliseDraftWith({
      userId: user.id, activeFamilyId,
      member: member && { userId: member.user_id, familyId: member.family_id, role: member.role },
      draft: { id: draft.id, familyId: draft.family_id, createdBy: draft.created_by, status: draft.status },
      candidates, votes: (votes ?? []).map((v) => ({
        candidateId: v.candidate_id, familyMemberId: v.family_member_id, reaction: v.reaction,
      })),
    }, async (intent) => {
      if (expectedWinner && intent.expected_winner !== expectedWinner) throw new Error("Draft results changed; refresh and retry");
      // RPC repeats authorization and scoring under a lock before persisting anything.
      const { data, error } = await supabase.rpc("finalise_dinner_draft", intent);
      if (error) throw error;
      return data;
    });
    revalidatePath("/tonight");
    revalidatePath(`/dinner-draft/${draftId}`);
    revalidatePath("/meal-plan");
    revalidatePath("/shopping-list");
    return { result } as const;
  } catch (error) {
    return { error: error instanceof Error ? error.message :
      typeof error === "object" && error !== null && "message" in error ? String(error.message) : "Finalisation failed" } as const;
  }
}

export async function startDinnerDraft(_previous: string | null, formData: FormData): Promise<string | null> {
  const date = formData.get("date");
  if (!validDinnerDate(date)) return "Choose a valid dinner date";
  let draftId: string;
  try {
    const { supabase } = await dinnerContext();
    const { data, error } = await supabase.rpc("start_dinner_draft", { dinner_date: date });
    if (error) throw error;
    if (!data) throw new Error("Draft could not be started");
    draftId = data;
  } catch (error) { return dinnerError(error); }
  revalidatePath("/tonight");
  redirect(`/dinner-draft/${draftId}`);
}

export async function reactToDinnerCandidate(draftId: string, candidateId: string, reaction: string) {
  if (!Object.hasOwn(REACTION_WEIGHTS, reaction)) return { error: "Choose a valid reaction" };
  try {
    const { supabase, familyId, member } = await dinnerContext();
    const { data: draft, error } = await supabase.from("dinner_drafts").select("id, family_id, status, expires_at")
      .eq("id", draftId).eq("family_id", familyId).maybeSingle();
    if (error) throw error;
    if (!draft || draft.family_id !== familyId) throw new Error("Draft not found in your active family");
    if (draft.status !== "open" || (draft.expires_at && Date.parse(draft.expires_at) <= Date.now())) throw new Error("Draft is closed for reactions");
    const { data: candidate, error: candidateError } = await supabase.from("draft_candidates")
      .select("id").eq("id", candidateId).eq("draft_id", draftId).maybeSingle();
    if (candidateError) throw candidateError;
    if (!candidate) throw new Error("Candidate not found in this draft");
    const { data: saved, error: voteError } = await supabase.from("draft_votes").upsert({ candidate_id: candidateId, family_member_id: member.id,
      reaction: reaction as keyof typeof REACTION_WEIGHTS }, { onConflict: "candidate_id,family_member_id" }).select("id").maybeSingle();
    if (voteError) throw voteError;
    if (!saved) throw new Error("Reaction was not saved. Refresh and retry.");
    revalidatePath(`/dinner-draft/${draftId}`);
    return { success: true };
  } catch (error) { return { error: dinnerError(error) }; }
}

export async function finishDinnerDraft(draftId: string, expectedWinner: string) {
  // Date is read from persisted candidates, never accepted from the client.
  const { supabase } = await dinnerContext();
  const { data: draft, error } = await supabase.from("dinner_drafts").select("status, winner_candidate_id").eq("id", draftId).maybeSingle();
  if (error) return { error: error.message };
  if (!draft) return { error: "Draft not found in your active family" };
  if (draft.status !== "finalised") {
    if (!expectedWinner) return { error: "Refresh the results before finalising" };
    const result = await finaliseDinnerDraft(draftId, expectedWinner);
    if ("error" in result) return result;
  }
  const { data: winner, error: winnerError } = await supabase.from("draft_candidates").select("target_date")
    .eq("draft_id", draftId).eq("id", draft.winner_candidate_id ?? expectedWinner).maybeSingle();
  if (winnerError || !winner?.target_date) return { error: "Dinner saved. Open Tonight to see your meal." };
  revalidatePath("/tonight");
  redirect(`/tonight?date=${winner.target_date}`);
}
