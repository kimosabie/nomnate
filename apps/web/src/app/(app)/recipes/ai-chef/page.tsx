import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AIChefChat } from "./AIChefChat";

export default async function AIChefPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  return <AIChefChat />;
}
