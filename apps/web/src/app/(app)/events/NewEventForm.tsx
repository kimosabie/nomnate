"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEvent } from "./actions";

const TYPES = [
  { key: "braai", label: "🔥 Braai" },
  { key: "party", label: "🎉 Party" },
  { key: "dinner", label: "🍽 Dinner" },
  { key: "other", label: "✨ Other" },
];

export function NewEventForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("braai");
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState("8");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    setError(null);
    setBusy(true);
    const result = await createEvent({
      name,
      eventType: type,
      eventDate: date || null,
      guestCount: guests ? Number(guests) : 4,
    });
    setBusy(false);
    if ("error" in result) return setError(result.error);
    router.push(`/events/${result.id}`);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-flame hover:bg-flame-dark text-white font-semibold py-2.5 rounded-full text-sm transition-colors"
      >
        ＋ Plan an event
      </button>
    );
  }

  return (
    <div className="bg-white rounded-[14px] border border-cream-border p-5 space-y-3">
      <p className="text-sm font-semibold text-charcoal">New event</p>
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Saturday Braai"
        maxLength={80}
        autoFocus
        className="w-full px-3 py-2 text-sm border border-cream-border rounded-xl bg-white text-charcoal placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent"
      />
      <div className="flex gap-1.5">
        {TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            className={`flex-1 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              type === t.key ? "border-flame bg-flame text-white" : "border-cream-border bg-white text-slate hover:border-flame/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <label className="flex-1 text-xs text-slate">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-0.5 w-full px-3 py-2 text-sm border border-cream-border rounded-xl bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent"
          />
        </label>
        <label className="w-24 text-xs text-slate">
          Guests
          <input
            type="number"
            min={1}
            max={500}
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
            className="mt-0.5 w-full px-3 py-2 text-sm border border-cream-border rounded-xl bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          disabled={busy || !name.trim()}
          className="bg-flame hover:bg-flame-dark disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-full text-sm transition-colors"
        >
          {busy ? "Creating…" : "Create event"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-slate hover:text-charcoal font-medium px-3 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
