"use client";

import { useState } from "react";

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      className="font-mono text-lg font-bold text-gray-900 tracking-widest hover:text-orange-500 transition-colors"
      title="Click to copy"
    >
      {code}
      <span className="block text-xs font-sans font-normal tracking-normal text-gray-400 mt-0.5">
        {copied ? "Copied!" : "Tap to copy"}
      </span>
    </button>
  );
}
