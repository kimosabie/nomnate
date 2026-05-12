import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!process.env.ADMIN_EMAIL || user.email !== process.env.ADMIN_EMAIL) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col">
      <nav className="border-b border-white/10 px-4 py-3 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-sm font-semibold text-[#E8621A]">NomNate Admin</span>
          <div className="flex items-center gap-6">
            <Link
              href="/admin/dashboard"
              className="text-xs text-white/50 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/feedback"
              className="text-xs text-white/50 hover:text-white transition-colors"
            >
              Feedback
            </Link>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <div className="flex-1">{children}</div>
    </div>
  );
}
