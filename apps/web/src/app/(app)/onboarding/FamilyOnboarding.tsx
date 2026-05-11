"use client";

import { useState, useActionState } from "react";
import { createFamily, joinFamily } from "./actions";

type Tab = "create" | "join";

const inputClass =
  "w-full px-4 py-2.5 border border-cream-border rounded-xl text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent placeholder:text-slate";
const labelClass = "block text-sm font-medium text-charcoal mb-1";

const COUNTRIES = [
  { code: "ZA", label: "South Africa", flag: "🇿🇦" },
  { code: "UK", label: "United Kingdom", flag: "🇬🇧" },
  { code: "FR", label: "France", flag: "🇫🇷" },
];

export function FamilyOnboarding() {
  const [tab, setTab] = useState<Tab>("create");
  const [country, setCountry] = useState("ZA");
  const [createError, createAction, createPending] = useActionState(createFamily, null);
  const [joinError, joinAction, joinPending] = useActionState(joinFamily, null);

  return (
    <div>
      <div className="flex rounded-full bg-cream p-1 mb-6 gap-1">
        {(["create", "join"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-full transition-all ${
              tab === t
                ? "bg-flame text-white shadow-sm"
                : "text-slate hover:text-charcoal"
            }`}
          >
            {t === "create" ? "Create family" : "Join family"}
          </button>
        ))}
      </div>

      {tab === "create" ? (
        <form action={createAction} className="space-y-4">
          {createError && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
              {createError}
            </p>
          )}
          <div>
            <label className={labelClass}>Your name</label>
            <input
              name="displayName"
              type="text"
              required
              placeholder="e.g. Mum"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Family name</label>
            <input
              name="familyName"
              type="text"
              required
              placeholder="e.g. The Ormistons"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Where are you shopping?</label>
            <div className="flex gap-2">
              {COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setCountry(c.code)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    country === c.code
                      ? "border-flame bg-flame-light text-flame-dark"
                      : "border-cream-border bg-white text-slate hover:border-flame/40"
                  }`}
                >
                  <span className="text-xl">{c.flag}</span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
            <input type="hidden" name="country" value={country} />
          </div>
          <button
            type="submit"
            disabled={createPending}
            className="w-full bg-flame hover:bg-flame-dark disabled:opacity-60 text-white font-semibold py-2.5 rounded-full text-sm transition-colors"
          >
            {createPending ? "Creating…" : "Create family"}
          </button>
        </form>
      ) : (
        <form action={joinAction} className="space-y-4">
          {joinError && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
              {joinError}
            </p>
          )}
          <div>
            <label className={labelClass}>Your name</label>
            <input
              name="displayName"
              type="text"
              required
              placeholder="e.g. Dad"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Invite code</label>
            <input
              name="inviteCode"
              type="text"
              required
              placeholder="e.g. A1B2C3D4"
              maxLength={8}
              className={`${inputClass} uppercase tracking-widest font-mono`}
            />
            <p className="text-xs text-slate mt-1">
              Ask your family admin for the 8-letter code
            </p>
          </div>
          <button
            type="submit"
            disabled={joinPending}
            className="w-full bg-flame hover:bg-flame-dark disabled:opacity-60 text-white font-semibold py-2.5 rounded-full text-sm transition-colors"
          >
            {joinPending ? "Joining…" : "Join family"}
          </button>
        </form>
      )}
    </div>
  );
}
