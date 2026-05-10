"use client";

import { useState, useTransition } from "react";
import { resetRecipeLibrary } from "./actions";

export function ResetRecipesButton() {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const err = await resetRecipeLibrary();
      if (err) setError(err);
      setConfirming(false);
    });
  }

  if (error) {
    return <p className="text-xs text-red-500">{error}</p>;
  }

  return (
    <div className="flex items-center gap-2">
      {confirming && (
        <span className="text-xs text-slate">Sure?</span>
      )}
      <button
        onClick={handleClick}
        onBlur={() => setConfirming(false)}
        className="text-xs font-semibold px-4 py-1.5 rounded-full border transition-colors"
        style={{
          borderColor: confirming ? "#E24B4A" : "#F5D5C0",
          color: confirming ? "#E24B4A" : "#999",
          background: "#fff",
        }}
      >
        {confirming ? "Yes, reset" : "Reset library"}
      </button>
    </div>
  );
}
