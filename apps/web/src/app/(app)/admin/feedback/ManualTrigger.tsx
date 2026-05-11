"use client";

import { useState } from "react";
import { runDailyBrief } from "./actions";

export function ManualTrigger() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleRun() {
    if (!confirm("Run the daily brief now? This will process all unreviewed feedback and send an email.")) return;
    setRunning(true);
    setResult(null);
    try {
      const json = await runDailyBrief();
      if (json.message) {
        setResult(json.message);
      } else if (json.ok) {
        setResult(`✅ Done — ${json.feedbackProcessed} feedback → ${json.todosCreated} todos`);
      } else {
        setResult(`⚠️ ${json.error ?? "Unknown error"}`);
      }
    } catch (e) {
      setResult(`⚠️ ${e instanceof Error ? e.message : "Failed"}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && <p className="text-xs text-slate">{result}</p>}
      <button
        onClick={handleRun}
        disabled={running}
        className="text-xs font-semibold px-3 py-1.5 rounded-full border border-[#F5D5C0] bg-[#FFF3EE] text-slate hover:text-charcoal transition-colors disabled:opacity-50 shrink-0"
      >
        {running ? "Running…" : "▶ Run daily brief"}
      </button>
    </div>
  );
}
