import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PreferencesForm } from "./PreferencesForm";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("family_members")
    .select(
      "name, dietary_restrictions, cuisine_preferences, ingredient_dislikes"
    )
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!member) redirect("/onboarding");

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-gray-400 hover:text-gray-700 text-lg leading-none transition-colors"
            aria-label="Back to dashboard"
          >
            &#8592;
          </Link>
          <span className="text-xl font-bold text-orange-500">
            Your preferences
          </span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <PreferencesForm
          name={member.name ?? ""}
          dietaryRestrictions={(member.dietary_restrictions as string[]) ?? []}
          cuisinePreferences={(member.cuisine_preferences as string[]) ?? []}
          ingredientDislikes={(member.ingredient_dislikes as string[]) ?? []}
        />
      </div>
    </main>
  );
}
