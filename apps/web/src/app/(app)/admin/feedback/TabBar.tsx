"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function TabBar({ feedbackCount, todoCount }: { feedbackCount: number; todoCount: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "feedback";

  return (
    <div className="flex gap-1 p-1 bg-cream rounded-full w-fit">
      {(["feedback", "todos"] as const).map((t) => (
        <button
          key={t}
          onClick={() => router.push(`?tab=${t}`)}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            tab === t ? "bg-white text-charcoal shadow-sm" : "text-slate hover:text-charcoal"
          }`}
        >
          {t === "feedback" ? `💬 Feedback (${feedbackCount})` : `📋 Todos (${todoCount})`}
        </button>
      ))}
    </div>
  );
}
