"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertCanFinalise, finaliseDraftWith } from "@nomnate/shared";

export async function finaliseDinnerDraft(draftId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" } as const;
  const { data: activeFamilyId, error: activeError } = await supabase.rpc("active_family_id");
  if (activeError || !activeFamilyId) return { error: activeError?.message ?? "No active family" } as const;
  const [{ data: member, error: memberError }, { data: draft, error: draftError }] = await Promise.all([
    supabase.from("family_members").select("user_id, family_id, role")
      .eq("user_id", user.id).eq("family_id", activeFamilyId).maybeSingle(),
    supabase.from("dinner_drafts").select("id, family_id, created_by, status").eq("id", draftId).maybeSingle(),
  ]);
  if (memberError || draftError) return { error: memberError?.message ?? draftError!.message } as const;
  if (!draft) return { error: "Draft not found in your active family" } as const;
  try {
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
      // RPC repeats authorization and scoring under a lock before persisting anything.
      const { data, error } = await supabase.rpc("finalise_dinner_draft", intent);
      if (error) throw error;
      return data;
    });
    revalidatePath("/meal-plan");
    revalidatePath("/shopping-list");
    return { result } as const;
  } catch (error) {
    return { error: error instanceof Error ? error.message :
      typeof error === "object" && error !== null && "message" in error ? String(error.message) : "Finalisation failed" } as const;
  }
}
