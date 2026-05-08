"use client";

import { useActionState } from "react";
import { generatePlan } from "./actions";

export function GeneratePlanButton() {
  const [error, formAction, pending] = useActionState(generatePlan, null);

  return (
    <form action={formAction} className="flex flex-col items-center gap-3">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors"
      >
        {pending ? "Generating plan…" : "Plan this week"}
      </button>
    </form>
  );
}
