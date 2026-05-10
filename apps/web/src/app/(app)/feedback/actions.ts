"use server";

import { createClient } from "@/lib/supabase/server";
import { filterText } from "@/lib/contentFilter";

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

  const mf = filterText(message, 2000);
  if (mf.error) return mf.error;
  if (!mf.value) return "Message is required";

  const { error } = await supabase.from("feedback").insert({
    type,
    message: mf.value,
    page_url: pageUrl,
    user_id: user.id,
  });

  if (error) return error.message;
  return null;
}
