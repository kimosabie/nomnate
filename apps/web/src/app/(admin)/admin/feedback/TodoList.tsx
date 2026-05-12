"use client";

import { useState, useTransition } from "react";
import { approveTodo, dismissTodo } from "./actions";

const PRIORITY_EMOJI: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
};
const CATEGORY_EMOJI: Record<string, string> = {
  bug: "🐛",
  feature: "✨",
  improvement: "⚡",
  content: "📝",
};
const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

type Todo = {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  category: string | null;
  source_feedback_ids: string[] | null;
  approved: boolean;
  approved_at: string | null;
  created_at: string;
};

export function TodoList({ initialTodos }: { initialTodos: Todo[] }) {
  const [todos, setTodos] = useState(initialTodos);
  const [pending, startTransition] = useTransition();

  const unapproved = [...todos.filter((t) => !t.approved)].sort(
    (a, b) => (PRIORITY_ORDER[a.priority ?? "low"] ?? 3) - (PRIORITY_ORDER[b.priority ?? "low"] ?? 3)
  );
  const approved = [...todos.filter((t) => t.approved)].sort(
    (a, b) => (PRIORITY_ORDER[a.priority ?? "low"] ?? 3) - (PRIORITY_ORDER[b.priority ?? "low"] ?? 3)
  );

  function handleApprove(id: string) {
    startTransition(async () => {
      await approveTodo(id);
      setTodos((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, approved: true, approved_at: new Date().toISOString() } : t
        )
      );
    });
  }

  function handleDismiss(id: string) {
    startTransition(async () => {
      await dismissTodo(id);
      setTodos((prev) => prev.filter((t) => t.id !== id));
    });
  }

  function copyForClaude() {
    const sections: Record<string, string[]> = { critical: [], high: [], medium: [], low: [] };
    for (const t of approved) {
      const p = t.priority ?? "low";
      sections[p]?.push(`• ${t.title}: ${t.description ?? ""}`);
    }
    const date = new Date().toLocaleDateString("en-ZA");
    const lines = [
      `NOMNATE TODO — Approved by admin on ${date}`,
      "═══════════════════════════════════════",
    ];
    for (const [p, items] of Object.entries(sections)) {
      if (items.length === 0) continue;
      lines.push(`\n${PRIORITY_EMOJI[p]} ${p.toUpperCase()}`);
      lines.push(...items);
    }
    navigator.clipboard.writeText(lines.join("\n"));
  }

  if (todos.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
        <p className="text-3xl mb-2">✅</p>
        <p className="text-sm text-white/50">No todo items yet. Run the daily brief to generate some.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {unapproved.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wide">
            Pending review ({unapproved.length})
          </p>
          {unapproved.map((t) => (
            <div key={t.id} className="bg-white/5 border border-[#E8621A]/30 rounded-xl p-4 space-y-2">
              <div className="flex items-start gap-2 flex-wrap">
                <span className="text-base leading-none mt-0.5">
                  {PRIORITY_EMOJI[t.priority ?? "low"]} {CATEGORY_EMOJI[t.category ?? "bug"]}
                </span>
                <p className="text-sm font-semibold text-white flex-1">{t.title}</p>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E8621A]/20 text-[#E8621A]">
                  {(t.priority ?? "low").toUpperCase()}
                </span>
              </div>
              {t.description && (
                <p className="text-sm text-white/70 leading-relaxed">{t.description}</p>
              )}
              {t.source_feedback_ids && t.source_feedback_ids.length > 0 && (
                <p className="text-xs text-white/30">
                  Based on {t.source_feedback_ids.length} feedback item{t.source_feedback_ids.length !== 1 ? "s" : ""}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleApprove(t.id)}
                  disabled={pending}
                  className="flex-1 py-1.5 rounded-full text-xs font-semibold text-white bg-green-700 hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  ✅ Approve for Claude Code
                </button>
                <button
                  onClick={() => handleDismiss(t.id)}
                  disabled={pending}
                  className="flex-1 py-1.5 rounded-full text-xs font-semibold text-white/40 border border-white/10 hover:border-white/30 hover:text-white/70 transition-colors disabled:opacity-50"
                >
                  🗑️ Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {approved.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wide">
              Approved ({approved.length})
            </p>
            <button
              onClick={copyForClaude}
              className="text-xs font-semibold text-[#E8621A] hover:text-[#ff8040] transition-colors"
            >
              📋 Copy for Claude Code
            </button>
          </div>
          {approved.map((t) => (
            <div key={t.id} className="bg-white/5 border border-green-900/40 rounded-xl p-4 space-y-1.5 opacity-70">
              <div className="flex items-start gap-2 flex-wrap">
                <span className="text-base leading-none mt-0.5">
                  {PRIORITY_EMOJI[t.priority ?? "low"]} {CATEGORY_EMOJI[t.category ?? "bug"]}
                </span>
                <p className="text-sm font-semibold text-white flex-1">{t.title}</p>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-900/40 text-green-400">
                  ✅ Approved
                </span>
              </div>
              {t.description && (
                <p className="text-xs text-white/50 leading-relaxed">{t.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
