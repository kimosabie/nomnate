"use client";

import { useActionState, useState } from "react";
import { SELECTABLE_COURSES, COURSE_LABELS, type Course } from "@nomnate/types";
import { updateFamilyCourses } from "./actions";

export function CoursePreferencesForm({ current }: { current: string[] }) {
  const initial = current.length > 0 ? current : ["main"];
  const [selected, setSelected] = useState<Set<string>>(new Set(initial));
  const [error, action, pending] = useActionState(updateFamilyCourses, null);
  const [saved, setSaved] = useState(false);

  const initialSet = new Set(initial);
  const isDirty =
    selected.size !== initialSet.size || [...selected].some((c) => !initialSet.has(c));

  function toggle(c: Course) {
    if (c === "main") return; // main is always on
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
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
        {SELECTABLE_COURSES.map((c) => {
          const on = c === "main" || selected.has(c);
          return (
            <label
              key={c}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                c === "main" ? "cursor-default" : "cursor-pointer"
              } ${on ? "border-flame bg-flame-light" : "border-cream-border bg-white"}`}
            >
              <input
                type="checkbox"
                name="courses"
                value={c}
                checked={on}
                disabled={c === "main"}
                onChange={() => toggle(c)}
                className="accent-flame w-4 h-4"
              />
              <span className={`text-sm font-medium ${on ? "text-flame-dark" : "text-slate"}`}>
                {COURSE_LABELS[c]}
                {c === "main" && <span className="text-xs text-slate font-normal"> · always on</span>}
              </span>
            </label>
          );
        })}
      </div>
      <button
        type="submit"
        disabled={pending || !isDirty}
        className="w-full bg-flame hover:bg-flame-dark disabled:opacity-50 text-white font-semibold py-2.5 rounded-full text-sm transition-colors"
      >
        {pending ? "Saving…" : saved ? "✓ Saved" : "Save courses"}
      </button>
    </form>
  );
}
