import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { FeedbackFab } from "@/components/FeedbackFab";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("family_members")
    .select("name")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const initials = member?.name
    ? member.name
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav initials={initials} />
      <div className="flex-1">{children}</div>
      <FeedbackFab />
    </div>
  );
}
