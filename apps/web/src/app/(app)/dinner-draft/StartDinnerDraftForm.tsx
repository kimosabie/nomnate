"use client";
import Link from "next/link";
import { useActionState } from "react";
import { startDinnerDraft } from "./actions";
export function StartDinnerDraftForm({ date }: { date: string }) {
  const [error, action, pending] = useActionState(startDinnerDraft, null);
  return <form action={action} className="space-y-4">
    <p className="text-slate">We’ll pick three dinner ideas from your family’s recipe library.</p>
    <label className="block font-medium">Dinner date<input type="date" name="date" defaultValue={date} required className="block mt-2 rounded-lg border border-cream-border p-3 w-full" /></label>
    {error && <div role="alert" className="space-y-2"><p>{error}</p><Link href="/recipes" className="text-flame underline">Browse or add recipes</Link><span> · </span><Link href="/meal-plan" className="text-flame underline">Meal planning</Link></div>}
    <button disabled={pending} className="w-full rounded-xl bg-flame text-white font-semibold p-3 disabled:opacity-50">{pending ? "Starting…" : "Start Dinner Draft"}</button>
  </form>;
}
