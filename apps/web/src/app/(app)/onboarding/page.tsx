import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FamilyOnboarding } from "./FamilyOnboarding";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Already in a family? Skip onboarding
  const { data: membership } = await supabase
    .from("family_members")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membership) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-orange-500">NomNate</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Set up your family to start planning meals
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <FamilyOnboarding />
        </div>
      </div>
    </div>
  );
}
