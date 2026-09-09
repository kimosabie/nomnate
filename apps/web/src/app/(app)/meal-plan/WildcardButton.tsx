"use client";

import { useActionState } from "react";
import { pickWildcardMeal } from "./actions";

export function WildcardButton() {
  const [error, action, pending] = useActionState(pickWildcardMeal, null);
  return (
    <form action={action} className="contents">
      <button type="submit" disabled={pending}
        className="bg-turmeric rounded-[12px] p-3 text-center w-full hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50">
        <span className="block text-2xl mb-1">🎲</span>
        <span className="block text-sm font-display font-medium text-white leading-tight">{pending ? "Picking…" : "Spin!"}</span>
        <span className="block text-[10px] uppercase text-white/80 tracking-wide font-medium mt-0.5">wildcard day</span>
      </button>
      {error && <p role="alert" className="col-span-3 text-xs text-red-600">{error}</p>}
    </form>
  );
}
