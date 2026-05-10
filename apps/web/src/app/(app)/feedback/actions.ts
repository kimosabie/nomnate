"use server";

import { createClient } from "@/lib/supabase/server";

type FeedbackType = "bug" | "idea" | "feedback";

export async function submitFeedback(
  type: FeedbackType,
  message: string,
  pageUrl: string
): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "Not signed in";

  const { error } = await supabase.from("feedback").insert({
    type,
    message: message.trim(),
    page_url: pageUrl,
    user_id: user.id,
  });

  if (error) return error.message;
  return null;
}
