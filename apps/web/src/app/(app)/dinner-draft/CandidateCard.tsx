import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { RecipeDisplay } from "@/lib/dinnerDraft";
export function CandidateCard({ recipe, recipeId, children }: { recipe: RecipeDisplay; recipeId: string | null; children?: ReactNode }) {
  const image = recipe.image_url && /^https?:\/\//.test(recipe.image_url) ? recipe.image_url : null;
  return <article className="overflow-hidden rounded-2xl border border-cream-border bg-white">
    {image ? <div className="relative h-48"><Image src={image} alt={recipe.title} fill unoptimized className="object-cover" /></div> : <div aria-hidden="true" className="h-32 bg-cream flex items-center justify-center text-5xl">🍽️</div>}
    <div className="p-5 space-y-3"><h2 className="font-display text-xl text-charcoal">{recipe.title}</h2>
      {recipe.description && <p className="text-sm text-slate line-clamp-3">{recipe.description}</p>}
      <p className="text-sm text-slate">{[recipe.cuisine, recipe.prep_time != null ? `${recipe.prep_time} min prep` : null, recipe.cook_time != null ? `${recipe.cook_time} min cooking` : null].filter(Boolean).join(" · ")}</p>
      {recipeId && <Link href={`/recipes/${recipeId}`} className="inline-block text-sm text-flame underline">View recipe</Link>}
      {children}
    </div>
  </article>;
}
