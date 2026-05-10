"use client";

import { useState, useCallback } from "react";
import { toggleItem } from "../actions";

interface ShoppingItem {
  id: string;
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
}

interface Props {
  initialItems: ShoppingItem[];
  storeLabel: string;
  storeSearchUrl: (q: string) => string;
  selectBg: string;
}

function formatLine(item: ShoppingItem): string {
  const qty = item.quantity != null ? String(item.quantity) : "";
  const suffix = [qty, item.unit].filter(Boolean).join(" ");
  return suffix ? `□ ${item.ingredient_name} — ${suffix}` : `□ ${item.ingredient_name}`;
}

export function StoreListClient({ initialItems, storeLabel, storeSearchUrl, selectBg }: Props) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    () => new Set(initialItems.filter((i) => i.checked).map((i) => i.id))
  );
  const [copied, setCopied] = useState(false);

  const toggle = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const nowChecked = !prev.has(id);
      const next = new Set(prev);
      nowChecked ? next.add(id) : next.delete(id);
      toggleItem(id, nowChecked);
      return next;
    });
  }, []);

  const unchecked = initialItems.filter((i) => !checkedIds.has(i.id));

  function getListText() {
    const header = `NomNate Shopping List — ${storeLabel}`;
    const divider = "─────────────────────";
    return `${header}\n${divider}\n${unchecked.map(formatLine).join("\n")}\n\nShared from NomNate — nomnate.co.za`;
  }

  function handleCopy() {
    if (!unchecked.length) return;
    const text = getListText();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text: string) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* ignore */ }
    document.body.removeChild(ta);
  }

  function handleWhatsApp() {
    if (!unchecked.length) return;
    const lines = unchecked.map(formatLine).join("\n");
    const text = [
      `🍽️ *NomNate Shopping List*`,
      `🛒 *${storeLabel}*`,
      `─────────────────────`,
      lines,
      ``,
      `_Shared from NomNate — nomnate.co.za_`,
    ].join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="bg-white rounded-[14px] border border-cream-border overflow-hidden">
      {/* Action bar */}
      {unchecked.length > 0 && (
        <div className="flex gap-2 p-3 border-b border-cream-border flex-wrap">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors"
            style={{
              borderColor: "#E8621A",
              background: copied ? "#E8621A" : "#fff",
              color: copied ? "#fff" : "#E8621A",
            }}
          >
            {copied ? "✓ Copied!" : "📋 Copy list"}
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-[#25D366] text-[#25D366] bg-white"
          >
            💬 Share on WhatsApp
          </button>
        </div>
      )}

      {/* Items */}
      <ul className="divide-y divide-cream-border">
        {initialItems.map((item) => {
          const isChecked = checkedIds.has(item.id);
          const qty = item.quantity != null ? String(item.quantity) : "";
          const qtyLabel = [qty, item.unit].filter(Boolean).join(" ");

          return (
            <li
              key={item.id}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
              style={{ opacity: isChecked ? 0.45 : 1 }}
              onClick={() => toggle(item.id)}
            >
              {/* Checkbox */}
              <div
                className="w-5 h-5 rounded-[5px] flex-shrink-0 flex items-center justify-center border-2 transition-colors"
                style={{
                  borderColor: isChecked ? "#E8621A" : "#F5D5C0",
                  background: isChecked ? "#E8621A" : "#fff",
                }}
              >
                {isChecked && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>

              {/* Name */}
              <span
                className="flex-1 text-sm font-medium"
                style={{
                  color: isChecked ? "#bbb" : "#1A1A1A",
                  textDecoration: isChecked ? "line-through" : "none",
                }}
              >
                {item.ingredient_name}
              </span>

              {/* Qty */}
              {qtyLabel && (
                <span className="text-xs text-slate flex-shrink-0">{qtyLabel}</span>
              )}

              {/* Search link */}
              <a
                href={storeSearchUrl(item.ingredient_name)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-shrink-0 text-slate hover:text-flame transition-colors"
                aria-label={`Search ${item.ingredient_name}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </li>
          );
        })}
      </ul>

      {/* All done state */}
      {unchecked.length === 0 && initialItems.length > 0 && (
        <div className="p-6 text-center">
          <p className="text-2xl mb-1">✅</p>
          <p className="text-sm font-semibold text-charcoal">All done at {storeLabel}!</p>
        </div>
      )}
    </div>
  );
}
