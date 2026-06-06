"use client";

import { useState, useTransition } from "react";
import { updateFamilyName } from "./actions";

export function FamilyNameForm({ currentName }: { currentName: string }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAction(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const err = await updateFamilyName(null, formData);
      if (err) setError(err);
      else setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <p className="text-base font-semibold text-charcoal">{currentName || "—"}</p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-flame hover:text-flame-dark font-medium"
          aria-label="Edit family name"
        >
          ✎ Edit
        </button>
      </div>
    );
  }

  return (
    <form action={handleAction} className="space-y-2">
      <input
        name="familyName"
        type="text"
        defaultValue={currentName}
        required
        maxLength={80}
        autoFocus
        className="w-full px-3 py-2 text-sm border border-cream-border rounded-xl bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-flame hover:bg-flame-dark disabled:opacity-50 text-white font-semibold px-4 py-1.5 rounded-full text-xs transition-colors"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setEditing(false);
          }}
          className="text-slate hover:text-charcoal font-medium px-3 py-1.5 text-xs"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
