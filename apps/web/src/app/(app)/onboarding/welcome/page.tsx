import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WelcomeForm } from "./WelcomeForm";

export default async function WelcomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("family_members")
    .select("name, family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const { data: family } = await supabase
    .from("families")
    .select("name")
    .eq("id", membership.family_id)
    .single();

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-medium leading-none">
            <span className="text-flame">Nom</span>
            <span className="text-herb">Nate</span>
          </h1>
          <p className="text-base font-semibold text-charcoal mt-4">
            Welcome to the {family?.name ?? "family"}! 🎉
          </p>
          <p className="text-sm text-slate mt-1">
            Tell us a bit about yourself so we can suggest meals you&apos;ll actually love.
          </p>
        </div>
        <div className="bg-white rounded-[14px] border border-cream-border p-8">
          <WelcomeForm defaultName={membership.name ?? ""} />
        </div>
        <div className="text-center mt-4">
          <a href="/dashboard" className="text-xs text-slate hover:text-charcoal transition-colors">
            Skip for now →
          </a>
        </div>
      </div>
    </div>
  );
}
