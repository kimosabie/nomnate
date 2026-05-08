"use client";

import { useActionState } from "react";
import { suggestWithAI } from "./actions";
import { FREE_AI_LIMIT } from "./constants";

export function AISuggestButton({
  remaining,
  variant = "primary",
}: {
  remaining: number;
  variant?: "primary" | "secondary";
}) {
  const [error, formAction, pending] = useActionState(suggestWithAI, null);
  const exhausted = remaining <= 0;

  const baseClass =
    variant === "primary"
      ? "w-full font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-60"
      : "w-full font-semibold px-5 py-2 rounded-xl text-sm transition-colors disabled:opacity-60 border";

  const colourClass =
    variant === "primary"
      ? "bg-gray-900 hover:bg-gray-800 text-white"
      : "border-gray-200 text-gray-700 hover:border-gray-300 bg-white";

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>
      )}
      <button
        type="submit"
        disabled={pending || exhausted}
        className={`${baseClass} ${colourClass}`}
      >
        {pending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Asking Claude…
          </span>
        ) : exhausted ? (
          "5/5 AI suggestions used · Upgrade for unlimited"
        ) : (
          <>
            Suggest with AI
            <span className="ml-2 text-xs opacity-60 font-normal">
              {remaining} of {FREE_AI_LIMIT} remaining this week
            </span>
          </>
        )}
      </button>
    </form>
  );
}
