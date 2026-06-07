import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { PreferencesForm } from "./PreferencesForm";
import { DeleteAccountSection } from "./DeleteAccountSection";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("family_members")
    .select(
      "name, dietary_restrictions, cuisine_preferences, ingredient_dislikes, allergies, liked_ingredients, diet_types, daily_calorie_target, track_calories, relationship, date_of_birth"
    )
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!member) redirect("/onboarding");

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-4 py-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-slate hover:text-charcoal transition-colors mb-3"
        >
          ← Home
        </Link>
        <h1 className="text-2xl font-display font-medium text-flame">Your preferences</h1>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-8 space-y-4">
        {isAdmin(user.email) && (
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-3 bg-charcoal text-white rounded-[14px] p-4 hover:bg-charcoal/90 transition-colors"
          >
            <span className="text-xl shrink-0">📊</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Admin dashboard</p>
              <p className="text-xs text-white/60">System health &amp; metrics</p>
            </div>
            <span className="text-white/60 text-sm shrink-0">→</span>
          </Link>
        )}
        <PreferencesForm
          name={member.name ?? ""}
          dietaryRestrictions={(member.dietary_restrictions as string[]) ?? []}
          cuisinePreferences={(member.cuisine_preferences as string[]) ?? []}
          ingredientDislikes={(member.ingredient_dislikes as string[]) ?? []}
          allergies={(member.allergies as string[]) ?? []}
          likedIngredients={(member.liked_ingredients as string[]) ?? []}
          dietTypes={(member.diet_types as string[]) ?? []}
          dailyCalorieTarget={member.daily_calorie_target ?? null}
          trackCalories={member.track_calories ?? false}
          relationship={member.relationship ?? null}
          dateOfBirth={member.date_of_birth ?? null}
        />
        <DeleteAccountSection />
      </div>
    </main>
  );
}
