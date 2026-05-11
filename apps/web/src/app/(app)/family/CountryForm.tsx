"use client";

import { useActionState, useState } from "react";
import { updateFamilyCountry } from "./actions";

const COUNTRIES = [
  { code: "ZA", label: "South Africa", flag: "🇿🇦" },
  { code: "UK", label: "United Kingdom", flag: "🇬🇧" },
  { code: "FR", label: "France", flag: "🇫🇷" },
];

export function CountryForm({ currentCountry }: { currentCountry: string }) {
  const [country, setCountry] = useState(currentCountry);
  const [error, action, pending] = useActionState(updateFamilyCountry, null);
  const [saved, setSaved] = useState(false);

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
      <div className="flex gap-2">
        {COUNTRIES.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => setCountry(c.code)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium transition-all ${
              country === c.code
                ? "border-flame bg-flame-light text-flame-dark"
                : "border-cream-border bg-white text-slate hover:border-flame/40"
            }`}
          >
            <span className="text-2xl">{c.flag}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>
      <input type="hidden" name="country" value={country} />
      <button
        type="submit"
        disabled={pending || country === currentCountry}
        className="w-full bg-flame hover:bg-flame-dark disabled:opacity-50 text-white font-semibold py-2.5 rounded-full text-sm transition-colors"
      >
        {pending ? "Saving…" : saved ? "✓ Saved" : "Save country"}
      </button>
    </form>
  );
}
