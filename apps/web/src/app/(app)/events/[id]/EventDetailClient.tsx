"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COURSE_LABELS, type Course } from "@nomnate/types";
import {
  updateEvent,
  deleteEvent,
  addDishFromRecipe,
  removeDish,
  type EventRow,
  type EventDish,
} from "../actions";

export type EventLibraryRecipe = { id: string; title: string; course: string | null };

// Course order for an event menu (sides/salads first feel natural for a braai)
const COURSE_ORDER = ["starter", "side", "main", "dessert"] as const;

const TYPE_EMOJI: Record<string, string> = { braai: "🔥", party: "🎉", dinner: "🍽", other: "✨" };

function fmtDate(iso: string | null): string {
  if (!iso) return "No date set";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function EventDetailClient({
  event: initialEvent,
  dishes: initialDishes,
  library,
}: {
  event: EventRow;
  dishes: EventDish[];
  library: EventLibraryRecipe[];
}) {
  const router = useRouter();
  const [event, setEvent] = useState<EventRow>(initialEvent);
  const [dishes, setDishes] = useState<EventDish[]>(initialDishes);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(event.name);
  const [date, setDate] = useState(event.event_date ?? "");
  const [guests, setGuests] = useState(String(event.guest_count));

  const [addCourse, setAddCourse] = useState<string>("main");
  const [search, setSearch] = useState("");

  const groups = COURSE_ORDER
    .map((c) => ({ course: c, items: dishes.filter((d) => d.course === c) }))
    .filter((g) => g.items.length > 0);

  const filtered = search
    ? library.filter((r) => r.title.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : [];

  async function handleSaveDetails() {
    setError(null);
    setBusy(true);
    const result = await updateEvent(event.id, {
      name,
      eventDate: date || null,
      guestCount: guests ? Number(guests) : undefined,
    });
    setBusy(false);
    if ("error" in result) return setError(result.error);
    setEvent((e) => ({ ...e, name, event_date: date || null, guest_count: guests ? Number(guests) : e.guest_count }));
    setEditing(false);
  }

  async function handleDeleteEvent() {
    if (!window.confirm("Delete this event and its menu?")) return;
    setBusy(true);
    const result = await deleteEvent(event.id);
    if ("error" in result) {
      setBusy(false);
      return setError(result.error);
    }
    router.push("/events");
  }

  async function handleAddDish(recipe: EventLibraryRecipe) {
    setError(null);
    setBusy(true);
    const result = await addDishFromRecipe(event.id, recipe.id, addCourse);
    setBusy(false);
    if ("error" in result) return setError(result.error);
    setDishes((prev) => [...prev, result.dish]);
    setSearch("");
  }

  async function handleRemoveDish(id: string) {
    setError(null);
    const prev = dishes;
    setDishes((d) => d.filter((x) => x.id !== id));
    const result = await removeDish(id);
    if ("error" in result) {
      setDishes(prev);
      setError(result.error);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-[14px] border border-cream-border p-5">
        {editing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="w-full px-3 py-2 text-sm border border-cream-border rounded-xl bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-cream-border rounded-xl bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent"
              />
              <input
                type="number"
                min={1}
                max={500}
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
                className="w-24 px-3 py-2 text-sm border border-cream-border rounded-xl bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveDetails}
                disabled={busy || !name.trim()}
                className="bg-flame hover:bg-flame-dark disabled:opacity-50 text-white font-semibold px-4 py-1.5 rounded-full text-xs transition-colors"
              >
                Save
              </button>
              <button onClick={() => setEditing(false)} className="text-slate hover:text-charcoal text-xs px-3 py-1.5">
                Cancel
              </button>
              <button onClick={handleDeleteEvent} className="ml-auto text-red-500 hover:text-red-600 text-xs px-3 py-1.5">
                Delete event
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-3xl shrink-0">{TYPE_EMOJI[event.event_type ?? "other"] ?? "✨"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-display font-medium text-charcoal truncate">{event.name}</p>
              <p className="text-xs text-slate">{fmtDate(event.event_date)} · {event.guest_count} guests</p>
            </div>
            <button onClick={() => setEditing(true)} className="text-xs text-flame hover:text-flame-dark font-medium shrink-0">
              Edit
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>}

      {/* Menu */}
      {groups.length === 0 ? (
        <p className="text-sm text-slate text-center py-4">No dishes yet — add some below.</p>
      ) : (
        groups.map((g) => (
          <div key={g.course} className="bg-white rounded-[14px] border border-cream-border overflow-hidden">
            <div className="px-4 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-flame-dark">
              {COURSE_LABELS[g.course as Course]}
            </div>
            <div className="divide-y divide-cream-border">
              {g.items.map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex-1 text-sm text-charcoal truncate">{d.label}</span>
                  <button
                    onClick={() => handleRemoveDish(d.id)}
                    className="p-1 rounded-md text-slate hover:text-red-500 hover:bg-red-50 transition-colors text-xs shrink-0"
                    title="Remove dish"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Add dish */}
      <div className="bg-white rounded-[14px] border border-cream-border p-5 space-y-3">
        <p className="text-sm font-semibold text-charcoal">Add a dish</p>
        <div className="flex gap-1.5">
          {COURSE_ORDER.map((c) => (
            <button
              key={c}
              onClick={() => setAddCourse(c)}
              className={`flex-1 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                addCourse === c ? "border-flame bg-flame text-white" : "border-cream-border bg-white text-slate hover:border-flame/40"
              }`}
            >
              {COURSE_LABELS[c as Course]}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your recipes to add…"
          disabled={busy}
          className="w-full px-3 py-2 text-sm border border-cream-border rounded-xl bg-white text-charcoal placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent"
        />
        {filtered.length > 0 && (
          <div className="max-h-44 overflow-y-auto space-y-0.5">
            {filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => handleAddDish(r)}
                disabled={busy}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-cream transition-colors text-left disabled:opacity-50"
              >
                <span className="flex-1 text-sm text-charcoal truncate">{r.title}</span>
                <span className="text-xs font-semibold text-flame shrink-0">Add</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
