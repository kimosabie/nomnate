"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "nomnate_invite_shown";

export function InviteModal({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
      localStorage.setItem(STORAGE_KEY, "1");
    }
  }, []);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const waText = encodeURIComponent(
    `👨‍👩‍👧‍👦 Join my family on NomNate!\n\nUse invite code: *${code}*\n\nSign up at www.nomnate.co.za\n\n_NomNate — Family dinner, decided together_`
  );

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div
        style={{
          background: "#fff", borderRadius: 16,
          border: "1px solid #F5D5C0",
          padding: 24, width: "100%", maxWidth: 360,
          boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <p style={{ fontSize: 36, marginBottom: 8 }}>🎉</p>
          <p style={{ fontWeight: 700, fontSize: 16, color: "#1A1A1A", margin: 0 }}>
            Your family is ready!
          </p>
          <p style={{ fontSize: 13, color: "#777", marginTop: 6 }}>
            Share this code to invite your family members.
          </p>
        </div>

        <div
          style={{
            fontFamily: "monospace", fontSize: 32, fontWeight: 700,
            letterSpacing: "0.1em", textAlign: "center",
            background: "#FFF3EE", border: "1px solid #F5D5C0",
            borderRadius: 10, padding: "14px 0",
            color: "#1A1A1A", marginBottom: 16,
          }}
        >
          {code}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button
            onClick={copy}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 50,
              background: "#E8621A", color: "#fff",
              border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            {copied ? "✓ Copied!" : "Copy code"}
          </button>
          <a
            href={`https://wa.me/?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1, padding: "10px 0", borderRadius: 50,
              border: "1.5px solid #25D366", color: "#25D366",
              fontSize: 13, fontWeight: 700, textAlign: "center",
              textDecoration: "none", display: "block",
            }}
          >
            💬 WhatsApp
          </a>
        </div>

        <button
          onClick={() => setOpen(false)}
          style={{
            width: "100%", padding: "10px 0", borderRadius: 50,
            background: "none", border: "1.5px solid #F5D5C0",
            color: "#777", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
