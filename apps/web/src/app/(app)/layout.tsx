import Link from "next/link";
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
    .select("name, family_id")
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

  const { data: family } = member?.family_id
    ? await supabase
        .from("families")
        .select("invite_code")
        .eq("id", member.family_id)
        .single()
    : { data: null };

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav initials={initials} inviteCode={family?.invite_code ?? null} />
      <div className="flex-1">{children}</div>
      <FeedbackFab />
      <footer className="border-t border-cream-border mt-4 pb-20 print:hidden">
        <div className="max-w-3xl mx-auto px-4 py-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate">
          <Link href="/privacy" className="hover:text-flame transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-flame transition-colors">Terms of Service</Link>
          <Link href="/cookies" className="hover:text-flame transition-colors">Cookies</Link>
          <span className="ml-auto">© {new Date().getFullYear()} NomNate</span>
        </div>
      </footer>
    </div>
  );
}
