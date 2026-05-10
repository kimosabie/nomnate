"use client";

import { useActionState, useState } from "react";
import { deleteAccount } from "./actions";

export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [error, action, pending] = useActionState(deleteAccount, null);

  return (
    <div className="bg-white rounded-[14px] border border-red-100 p-5">
      <h2 className="text-sm font-semibold text-charcoal mb-1">Delete account</h2>
      <p className="text-xs text-slate mb-4">
        Permanently deletes your account and all your data. If you are the only member of
        your family, the family plan, recipes, and shopping lists are also deleted.
        This cannot be undone.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-semibold text-red-600 hover:text-red-700 underline"
        >
          Delete my account
        </button>
      ) : (
        <form action={action} className="space-y-3">
          <p className="text-xs font-medium text-charcoal">
            Type <strong>DELETE</strong> to confirm:
          </p>
          <input
            name="confirmation"
            type="text"
            autoComplete="off"
            placeholder="DELETE"
            className="w-full px-3 py-2 border border-red-200 rounded-xl text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-red-400 placeholder:text-slate"
          />
          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-full transition-colors"
            >
              {pending ? "Deleting…" : "Delete my account"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate hover:text-charcoal rounded-full border border-cream-border transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
