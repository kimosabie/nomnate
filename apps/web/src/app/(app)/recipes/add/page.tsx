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
      <div className="max-w-3xl mx-auto px-4 py-4">
        <Link
          href="/recipes"
          className="inline-flex items-center gap-1 text-sm text-slate hover:text-charcoal transition-colors mb-3"
        >
          ← Recipes
        </Link>
        <h1 className="text-2xl font-display font-medium text-flame">Add your recipe</h1>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-8">
        <AddRecipeForm />
      </div>
    </main>
  );
}
