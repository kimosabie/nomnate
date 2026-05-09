"use client";

import { useActionState } from "react";
import { generatePlan } from "./actions";

export function GeneratePlanButton() {
  const [error, formAction, pending] = useActionState(generatePlan, null);

  return (
    <form action={formAction} className="flex flex-col items-center gap-3">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-flame hover:bg-flame-dark disabled:opacity-60 text-white font-semibold px-8 py-3 rounded-full text-sm transition-colors"
      >
        {pending ? "Generating plan…" : "Plan this week"}
      </button>
    </form>
  );
}
