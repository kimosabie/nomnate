import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddRecipeForm } from "./AddRecipeForm";

export default async function AddRecipePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  return (
    <main className="min-h-screen bg-cream">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link
            href="/recipes"
            className="text-slate hover:text-charcoal text-lg leading-none transition-colors"
            aria-label="Back to recipes"
          >
            &#8592;
          </Link>
          <span className="text-xl font-semibold text-flame">Add your recipe</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <AddRecipeForm />
      </div>
    </main>
  );
}
