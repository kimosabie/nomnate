"use client";

import { useState } from "react";
import { runDailyBrief } from "./actions";

export function ManualTrigger() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleRun() {
    if (!confirm("Send unreviewed feedback to Claude and generate todo items?")) return;
    setRunning(true);
    setResult(null);
    try {
      const json = await runDailyBrief();
      if (json.message) {
        setResult(json.message);
      } else if (json.ok) {
        setResult(`✅ Done — ${json.feedbackProcessed} feedback → ${json.todosCreated} todos`);
      } else {
        setResult(`⚠️ ${json.error ?? "Unknown error"}${json.detail ? `: ${json.detail}` : ""}`);
      }
    } catch (e) {
      setResult(`⚠️ ${e instanceof Error ? e.message : "Failed"}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && <p className="text-xs text-white/50">{result}</p>}
      <button
        onClick={handleRun}
        disabled={running}
        className="text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-colors disabled:opacity-40 shrink-0"
      >
        {running ? "Running…" : "▶ Run daily brief"}
      </button>
    </div>
  );
}
