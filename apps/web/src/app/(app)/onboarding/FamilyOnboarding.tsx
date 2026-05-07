"use client";

import { useState, useActionState } from "react";
import { createFamily, joinFamily } from "./actions";

type Tab = "create" | "join";

const inputClass =
  "w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent";
const labelClass = "block text-sm font-medium text-gray-700 mb-1";

export function FamilyOnboarding() {
  const [tab, setTab] = useState<Tab>("create");
  const [createError, createAction, createPending] = useActionState(
    createFamily,
    null
  );
  const [joinError, joinAction, joinPending] = useActionState(joinFamily, null);

  return (
    <div>
      <div className="flex rounded-lg bg-gray-100 p-1 mb-6 gap-1">
        {(["create", "join"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              tab === t
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "create" ? "Create family" : "Join family"}
          </button>
        ))}
      </div>

      {tab === "create" ? (
        <form action={createAction} className="space-y-4">
          {createError && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
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
          <button
            type="submit"
            disabled={createPending}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
          >
            {createPending ? "Creating…" : "Create family"}
          </button>
        </form>
      ) : (
        <form action={joinAction} className="space-y-4">
          {joinError && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
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
            <p className="text-xs text-gray-400 mt-1">
              Ask your family admin for the 8-letter code
            </p>
          </div>
          <button
            type="submit"
            disabled={joinPending}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
          >
            {joinPending ? "Joining…" : "Join family"}
          </button>
        </form>
      )}
    </div>
  );
}
