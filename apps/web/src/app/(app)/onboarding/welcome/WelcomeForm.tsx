"use client";

import { useState, useActionState } from "react";
import { completeSetup } from "./actions";
import { DIETARY_RESTRICTIONS } from "@nomnate/types";

const RELATIONSHIPS: { value: string; emoji: string; label: string }[] = [
  { value: "mom",         emoji: "👩",  label: "Mom" },
  { value: "dad",         emoji: "👨",  label: "Dad" },
  { value: "grandmother", emoji: "👵",  label: "Grandma" },
  { value: "grandfather", emoji: "👴",  label: "Grandpa" },
  { value: "brother",     emoji: "👦",  label: "Brother" },
  { value: "sister",      emoji: "👧",  label: "Sister" },
  { value: "son",         emoji: "👶",  label: "Son" },
  { value: "daughter",    emoji: "🌸",  label: "Daughter" },
  { value: "uncle",       emoji: "👨‍👦",  label: "Uncle" },
  { value: "aunt",        emoji: "👩‍👦",  label: "Aunt" },
  { value: "cousin",      emoji: "👫",  label: "Cousin" },
  { value: "other",       emoji: "😊",  label: "Other" },
];

function computeAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const inputClass =
  "w-full px-4 py-2.5 border border-cream-border rounded-xl text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent placeholder:text-slate";
const labelClass = "block text-sm font-medium text-charcoal mb-1.5";

export function WelcomeForm({ defaultName }: { defaultName: string }) {
  const [error, action, pending] = useActionState(completeSetup, null);
  const [selectedRelationship, setSelectedRelationship] = useState<string | null>(null);
  const [dob, setDob] = useState("");

  const ageDisplay = dob && !isNaN(new Date(dob).getTime())
    ? (() => {
        const a = computeAge(dob);
        if (a < 1 || a > 120) return null;
        return `${a} years old`;
      })()
    : null;

  return (
    <form action={action} className="space-y-6">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}

      {/* Name */}
      <div>
        <label className={labelClass}>What&apos;s your name?</label>
        <input
          name="name"
          type="text"
          required
          defaultValue={defaultName}
          placeholder="e.g. Mum"
          className={inputClass}
        />
      </div>

      {/* Relationship */}
      <div>
        <label className={labelClass}>Who are you in the family?</label>
        <input type="hidden" name="relationship" value={selectedRelationship ?? ""} />
        <div className="grid grid-cols-2 gap-2">
          {RELATIONSHIPS.map((r) => {
            const active = selectedRelationship === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => setSelectedRelationship(active ? null : r.value)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-full text-[13px] font-medium transition-all border"
                style={{
                  background: active ? "#E8621A" : "#FFF3EE",
                  borderColor: active ? "#E8621A" : "#F5D5C0",
                  color: active ? "#fff" : "#1A1A1A",
                }}
              >
                <span>{r.emoji}</span>
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Age / DOB */}
      <div>
        <label className={labelClass}>How old are you?</label>
        <input
          name="date_of_birth"
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          className={inputClass + " max-w-xs"}
        />
        {ageDisplay && (
          <p className="text-xs text-slate mt-1.5">{ageDisplay}</p>
        )}
      </div>

      {/* Dietary needs */}
      <div>
        <label className={labelClass}>Any dietary needs?</label>
        <div className="grid grid-cols-2 gap-2">
          {DIETARY_RESTRICTIONS.map((r) => (
            <label key={r} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                name="dietary_restrictions"
                value={r}
                className="w-4 h-4 rounded border-cream-border text-flame focus:ring-flame"
              />
              <span className="text-sm text-charcoal capitalize">{r}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-flame hover:bg-flame-dark disabled:opacity-60 text-white font-semibold py-3 rounded-full text-sm transition-colors"
      >
        {pending ? "Saving…" : "Let's go! →"}
      </button>
    </form>
  );
}
