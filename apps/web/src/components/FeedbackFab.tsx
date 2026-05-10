"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { submitFeedback } from "@/app/(app)/feedback/actions";

type FeedbackType = "bug" | "idea" | "feedback";

const TYPE_LABELS: Record<FeedbackType, string> = {
  bug: "🐛 Bug",
  idea: "💡 Idea",
  feedback: "💬 Feedback",
};

export function FeedbackFab() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("feedback");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    const err = await submitFeedback(type, message, pathname);
    setSubmitting(false);

    if (err) {
      setError(err);
      return;
    }

    setSubmitted(true);
    setTimeout(() => {
      setOpen(false);
      setSubmitted(false);
      setMessage("");
      setType("feedback");
    }, 1500);
  }

  function handleClose() {
    if (submitting) return;
    setOpen(false);
    setError(null);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-11 h-11 rounded-full bg-flame text-white flex items-center justify-center shadow-[0_2px_8px_rgba(232,98,26,0.3)] hover:bg-flame-dark transition-colors z-50"
        aria-label="Send feedback"
        title="Send feedback"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <div className="bg-white rounded-[14px] border border-cream-border w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold text-charcoal">Send feedback</p>
              <button
                onClick={handleClose}
                className="text-slate hover:text-charcoal text-xl leading-none w-7 h-7 flex items-center justify-center"
              >
                ×
              </button>
            </div>

            {submitted ? (
              <div className="text-center py-4">
                <p className="text-3xl mb-2">🙏</p>
                <p className="text-sm font-medium text-charcoal">
                  Thanks! We&apos;ll look into it.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex gap-2">
                  {(Object.keys(TYPE_LABELS) as FeedbackType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`flex-1 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        type === t
                          ? "bg-flame border-flame text-white"
                          : "border-cream-border text-slate hover:border-flame hover:text-flame"
                      }`}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>

                {error && (
                  <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">
                    {error}
                  </p>
                )}

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what's on your mind…"
                  rows={4}
                  className="w-full px-3 py-2.5 text-sm border border-cream-border rounded-xl text-charcoal placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent resize-none"
                  required
                />

                <button
                  type="submit"
                  disabled={!message.trim() || submitting}
                  className="w-full bg-flame hover:bg-flame-dark disabled:opacity-50 text-white font-semibold py-2.5 rounded-full text-sm transition-colors"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending…
                    </span>
                  ) : (
                    "Send"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
