"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
export async function castVote(
  slotId: string,
  memberId: string,
  value: "up" | "down" | "love"
): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";

  // Verify the memberId the client sent actually belongs to this user
  const { data: member } = await supabase
    .from("family_members")
    .select("id")
    .eq("id", memberId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return "Unauthorized";

  // One vote per member per day — get this slot's day
  const { data: targetSlot } = await supabase
    .from("meal_plan_slots")
    .select("day_of_week, meal_plan_id, course")
    .eq("id", slotId)
    .single();
  if (!targetSlot) return "Slot not found";

  // Find any other slot the member has already voted on for this day
  const { data: dayVotes } = await supabase
    .from("votes")
    .select("meal_plan_slot_id")
    .eq("member_id", memberId)
    .neq("meal_plan_slot_id", slotId);

  if (dayVotes && dayVotes.length > 0) {
    const otherSlotIds = dayVotes.map((v) => v.meal_plan_slot_id);
    const { data: sameDay } = await supabase
      .from("meal_plan_slots")
      .select("id")
      .in("id", otherSlotIds)
      .eq("day_of_week", targetSlot.day_of_week)
      .eq("meal_plan_id", targetSlot.meal_plan_id)
      .eq("course", targetSlot.course);
    if (sameDay && sameDay.length > 0) {
      return "You've already voted for this course — one vote per day and course";
    }
  }

  const { error } = await supabase.from("votes").upsert(
    { meal_plan_slot_id: slotId, member_id: memberId, value },
    { onConflict: "meal_plan_slot_id,member_id" }
  );

  if (error) return error.message;
  revalidatePath("/meal-plan");
  return null;
}
