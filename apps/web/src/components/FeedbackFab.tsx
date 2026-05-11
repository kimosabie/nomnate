"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type FeedbackType = "bug" | "idea" | "feedback";

export function FeedbackFab() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("feedback");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageUrl, setPageUrl] = useState("");

  useEffect(() => {
    setPageUrl(window.location.pathname);
  }, [open]);

  async function handleSubmit() {
    if (!message.trim() || submitting) return;
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error: dbError } = await supabase.from("feedback").insert({
      type,
      message: message.trim(),
      page_url: pageUrl,
      user_id: user?.id ?? null,
    });

    setSubmitting(false);

    if (dbError) {
      setError(dbError.message);
      return;
  
    }

    // Get member + family context for email notification
    const { data: member } = await supabase
      .from("family_members")
      .select("name, families(name)")
      .eq("user_id", user?.id ?? '')
      .single();

    await fetch('/api/feedback-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        message: message.trim(),
        pageUrl,
        userName: member?.name ?? undefined,
        familyName: (member?.families as any)?.name ?? undefined,
      })
    })

    setSubmitted(true);
    setTimeout(() => {
      setOpen(false);
      setSubmitted(false);
      setMessage("");
      setType("feedback");
      setError(null);
    }, 2000);
  }

  const TYPES: { key: FeedbackType; label: string }[] = [
    { key: "bug", label: "🐛 Bug" },
    { key: "idea", label: "💡 Idea" },
    { key: "feedback", label: "⭐ Feedback" },
  ];

  return (
    <>
      {/* Modal */}
      {open && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 999,
            background: "rgba(0,0,0,0.25)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            padding: "0 16px 90px",
          }}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div style={{
            width: "100%", maxWidth: 360,
            background: "#fff", borderRadius: 16,
            border: "1px solid #F5D5C0", padding: 20,
            boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: "#1A1A1A" }}>Send feedback</span>
              <button
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#999", lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {submitted ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🙏</div>
                <p style={{ fontWeight: 600, fontSize: 14, color: "#1A1A1A" }}>Thanks! We&apos;ll look into it.</p>
              </div>
            ) : (
              <>
                {/* Type selector */}
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {TYPES.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setType(key)}
                      style={{
                        flex: 1, borderRadius: 50, padding: "7px 0",
                        fontSize: 11, fontWeight: 600, border: "1.5px solid",
                        borderColor: type === key ? "#E8621A" : "#F5D5C0",
                        background: type === key ? "#E8621A" : "#fff",
                        color: type === key ? "#fff" : "#777",
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Error */}
                {error && (
                  <p style={{ fontSize: 12, color: "#dc2626", background: "#fef2f2", padding: "8px 12px", borderRadius: 8, marginBottom: 10 }}>
                    {error}
                  </p>
                )}

                {/* Textarea */}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what's on your mind…"
                  rows={4}
                  style={{
                    width: "100%", border: "1.5px solid #F5D5C0", borderRadius: 10,
                    padding: 10, fontSize: 13, resize: "none", outline: "none",
                    color: "#1A1A1A", background: "#FFFAF8",
                    boxSizing: "border-box",
                  }}
                />

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!message.trim() || submitting}
                  style={{
                    width: "100%", marginTop: 10,
                    background: message.trim() && !submitting ? "#E8621A" : "#F5D5C0",
                    color: "#fff", border: "none", borderRadius: 50,
                    padding: "11px 0", fontSize: 13, fontWeight: 600,
                    cursor: message.trim() && !submitting ? "pointer" : "default",
                  }}
                >
                  {submitting ? "Sending…" : "Send feedback"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Send feedback"
        className="print:hidden"
        style={{
          position: "fixed", bottom: 24, right: 24,
          width: 48, height: 48, borderRadius: "50%",
          background: "#E8621A", color: "#fff",
          border: "none", cursor: "pointer", zIndex: 1000,
          fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 12px rgba(232,98,26,0.4)",
        }}
      >
        {open ? "✕" : "💬"}
      </button>
    </>
  );
}
