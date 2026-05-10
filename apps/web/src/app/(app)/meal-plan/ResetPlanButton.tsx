"use client";

import { useActionState } from "react";
import { resetPlan } from "./actions";

export function ResetPlanButton() {
  const [error, formAction, pending] = useActionState(resetPlan, null);

  return (
    <form action={formAction} className="inline">
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-slate hover:text-red-500 disabled:opacity-50 transition-colors"
        title="Clear this week's plan and regenerate"
      >
        {pending ? "Regenerating…" : "Regenerate"}
      </button>
    </form>
  );
}
