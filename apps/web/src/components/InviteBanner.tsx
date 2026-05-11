"use client";

import { useState } from "react";

export function InviteBanner({ code, familyName }: { code: string; familyName: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (dismissed) return null;

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const waText = encodeURIComponent(
    `👨‍👩‍👧‍👦 Join my family on NomNate!\n\nUse invite code: *${code}*\n\nSign up at www.nomnate.co.za\n\n_NomNate — Family dinner, decided together_`
  );

  return (
    <div
      className="rounded-[14px] p-4 relative"
      style={{ background: "#FFF3EE", border: "2px solid #E8621A" }}
    >
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-slate hover:text-charcoal text-sm leading-none"
        aria-label="Dismiss"
      >
        ✕
      </button>

      <p className="text-sm font-semibold text-charcoal mb-1">
        👨‍👩‍👧‍👦 Invite your family to NomNate!
      </p>
      <p className="text-xs text-slate mb-3">
        Share this code so they can join {familyName}.
      </p>

      <div
        className="font-mono text-[28px] font-semibold text-charcoal tracking-[0.1em] text-center py-3 mb-3 rounded-[10px] border border-[#F5D5C0] bg-white"
        style={{ letterSpacing: "0.1em" }}
      >
        {code}
      </div>

      <div className="flex gap-2">
        <button
          onClick={copy}
          className="flex-1 py-2 rounded-full text-sm font-semibold text-white transition-colors"
          style={{ background: "#E8621A" }}
        >
          {copied ? "✓ Copied!" : "Copy code"}
        </button>
        <a
          href={`https://wa.me/?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-2 rounded-full text-sm font-semibold text-center border transition-colors"
          style={{ borderColor: "#25D366", color: "#25D366" }}
        >
          💬 WhatsApp
        </a>
      </div>
    </div>
  );
}
