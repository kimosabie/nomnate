"use client";

import { useActionState } from "react";
import { generateShoppingList } from "./actions";

export function GenerateShoppingListButton({ hasExisting }: { hasExisting: boolean }) {
  const [error, formAction, pending] = useActionState(generateShoppingList, null);

  return (
    <form action={formAction} className="flex flex-col items-stretch gap-2">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
      >
        {pending
          ? "Generating…"
          : hasExisting
          ? "Regenerate shopping list"
          : "Generate shopping list"}
      </button>
    </form>
  );
}
