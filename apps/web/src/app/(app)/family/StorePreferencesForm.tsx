"use client";

import { useActionState, useState } from "react";
import { updatePreferredStores } from "./actions";

interface StoreOption {
  key: string;
  label: string;
}

export function StorePreferencesForm({
  stores,
  currentPreferred,
}: {
  stores: StoreOption[];
  currentPreferred: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(currentPreferred.length > 0 ? currentPreferred : stores.map((s) => s.key))
  );
  const [error, action, pending] = useActionState(updatePreferredStores, null);
  const [saved, setSaved] = useState(false);

  const initial = new Set(
    currentPreferred.length > 0 ? currentPreferred : stores.map((s) => s.key)
  );
  const isDirty =
    selected.size !== initial.size || [...selected].some((k) => !initial.has(k));

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev; // always keep at least one
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function handleAction(formData: FormData) {
    await action(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <form action={handleAction} className="space-y-3">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}
      <div className="flex flex-col gap-2">
        {stores.map((s) => (
          <label
            key={s.key}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
              selected.has(s.key)
                ? "border-flame bg-flame-light"
                : "border-cream-border bg-white"
            }`}
          >
            <input
              type="checkbox"
              name="stores"
              value={s.key}
              checked={selected.has(s.key)}
              onChange={() => toggle(s.key)}
              className="accent-flame w-4 h-4"
            />
            <span
              className={`text-sm font-medium ${selected.has(s.key) ? "text-flame-dark" : "text-slate"}`}
            >
              {s.label}
            </span>
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={pending || !isDirty}
        className="w-full bg-flame hover:bg-flame-dark disabled:opacity-50 text-white font-semibold py-2.5 rounded-full text-sm transition-colors"
      >
        {pending ? "Saving…" : saved ? "✓ Saved" : "Save store preferences"}
      </button>
    </form>
  );
}
