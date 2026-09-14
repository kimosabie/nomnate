import { createClient } from "@/lib/supabase/server";
import { scoreDraft, type DraftResult } from "@nomnate/shared";
import type { Database } from "@nomnate/supabase";
type Json = Database["public"]["Tables"]["draft_candidates"]["Row"]["recipe_snapshot"];

export function draftIsOpen(draft: { status: string; expires_at: string | null }, now = Date.now()) {
  return draft.status === "open" && (!draft.expires_at || Date.parse(draft.expires_at) > now);
}

export async function dinnerContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not authenticated");
  const { data: familyId, error: familyError } = await supabase.rpc("active_family_id");
  if (familyError) throw familyError;
  if (!familyId) throw new Error("No active family");
  const { data: member, error: memberError } = await supabase.from("family_members")
    .select("id, user_id, family_id, role").eq("family_id", familyId).eq("user_id", user.id).maybeSingle();
  if (memberError) throw memberError;
  if (!member) throw new Error("No active family membership");
  return { supabase, user, familyId, member };
}

export type RecipeDisplay = { title: string; image_url: string | null; description: string | null; prep_time: number | null; cook_time: number | null; cuisine: string | null };
export function snapshotDisplay(snapshot: Json): RecipeDisplay {
  const r = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot : {};
  const str = (key: string) => typeof r[key] === "string" ? r[key] as string : null;
  const num = (key: string) => typeof r[key] === "number" ? r[key] as number : null;
  return { title: str("title") || "Dinner idea", image_url: str("image_url"), description: str("description"), prep_time: num("prep_time"), cook_time: num("cook_time"), cuisine: str("cuisine") };
}

export async function loadDinnerDraft(draftId: string) {
  const context = await dinnerContext();
  const { supabase, familyId, member, user } = context;
  const { data: draft, error } = await supabase.from("dinner_drafts").select("*")
    .eq("id", draftId).eq("family_id", familyId).maybeSingle();
  if (error) throw error;
  if (!draft || draft.family_id !== familyId || draft.draft_type === "weekly") return null;
  const { data: candidates, error: candidateError } = await supabase.from("draft_candidates")
    .select("*").eq("draft_id", draft.id).order("display_order");
  if (candidateError) throw candidateError;
  const { data: votes, error: voteError } = candidates?.length
    ? await supabase.from("draft_votes").select("candidate_id, family_member_id, reaction").in("candidate_id", candidates.map(c => c.id))
    : { data: [], error: null };
  if (voteError) throw voteError;
  const reactions = votes ?? [];
  const liveResult = scoreDraft(candidates ?? [], reactions.map(v => ({ candidateId: v.candidate_id, familyMemberId: v.family_member_id, reaction: v.reaction })));
  const result = draft.status === "finalised" && draft.result ? draft.result as unknown as DraftResult : liveResult;
  return { draft, candidates: (candidates ?? []).map(c => ({ ...c, recipe: snapshotDisplay(c.recipe_snapshot), reaction: reactions.find(v => v.candidate_id === c.id && v.family_member_id === member.id)?.reaction ?? null })),
    result, participants: new Set(reactions.map(v => v.family_member_id)).size,
    canManage: draft.created_by === user.id || member.role === "admin",
    isOpen: draftIsOpen(draft) };
}

export function dinnerError(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error ? String(error.message) : "Dinner Draft could not be updated. Please try again.";
}
