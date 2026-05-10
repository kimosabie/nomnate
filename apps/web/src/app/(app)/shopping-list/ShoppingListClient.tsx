"use client";

import { useState, useCallback } from "react";
import { assignStore } from "./storeUtils";
import { toggleItem } from "./actions";

interface ShoppingItem {
  id: string;
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
  store: string | null;
  checked: boolean;
}

interface Props {
  initialItems: ShoppingItem[];
}

const STORE_KEYS = ["woolworths", "pnp", "checkers"] as const;
type StoreKey = (typeof STORE_KEYS)[number];

const STORE_LABELS: Record<StoreKey, string> = {
  woolworths: "Woolworths",
  pnp: "Pick n Pay",
  checkers: "Checkers / Sixty60",
};

const STORE_SEARCH: Record<StoreKey, (q: string) => string> = {
  woolworths: (q) => `https://www.woolworths.co.za/cat?Ntt=${encodeURIComponent(q)}`,
  pnp: (q) => `https://www.pnp.co.za/pnpstorefront/search?q=${encodeURIComponent(q)}`,
  checkers: (q) => `https://www.sixty60.co.za/search?q=${encodeURIComponent(q)}`,
};

function resolvedStore(item: ShoppingItem): StoreKey {
  if (item.store && STORE_KEYS.includes(item.store as StoreKey)) {
    return item.store as StoreKey;
  }
  return assignStore(item.ingredient_name);
}

function formatLine(item: ShoppingItem): string {
  const qty = item.quantity != null ? String(item.quantity) : "";
  const suffix = [qty, item.unit].filter(Boolean).join(" ");
  return suffix ? `□ ${item.ingredient_name} — ${suffix}` : `□ ${item.ingredient_name}`;
}

export function ShoppingListClient({ initialItems }: Props) {
  const [selectedStore, setSelectedStore] = useState<StoreKey | "all">("all");
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

  const withStore = initialItems.map((i) => ({ ...i, resolvedStore: resolvedStore(i) }));

  const storeCounts = STORE_KEYS.reduce<Record<string, number>>((acc, key) => {
    acc[key] = withStore.filter((i) => !checkedIds.has(i.id) && i.resolvedStore === key).length;
    return acc;
  }, {});
  const totalRemaining = withStore.filter((i) => !checkedIds.has(i.id)).length;

  const displayed =
    selectedStore === "all"
      ? withStore
      : withStore.filter((i) => i.resolvedStore === selectedStore);

  const storeLabel =
    selectedStore === "all" ? "Full list" : STORE_LABELS[selectedStore];

  function getListText() {
    const unchecked = displayed.filter((i) => !checkedIds.has(i.id));
    const header = `NomNate Shopping List — ${storeLabel}`;
    const divider = "─────────────────────";
    return `${header}\n${divider}\n${unchecked.map(formatLine).join("\n")}\n\nShared from NomNate — nomnate.co.za`;
  }

  function handleCopy() {
    const unchecked = displayed.filter((i) => !checkedIds.has(i.id));
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
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
    document.body.removeChild(ta);
  }

  function handleWhatsApp() {
    const unchecked = displayed.filter((i) => !checkedIds.has(i.id));
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
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // pill style helper
  const pill = (active: boolean) =>
    ({
      borderRadius: 50,
      padding: "7px 14px",
      fontSize: 12,
      fontWeight: 600,
      border: "1.5px solid",
      borderColor: active ? "#E8621A" : "#F5D5C0",
      background: active ? "#E8621A" : "#fff",
      color: active ? "#fff" : "#777",
      cursor: "pointer",
      transition: "all 0.15s",
    }) as React.CSSProperties;

  return (
    <div>
      {/* Store filter bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={() => setSelectedStore("all")} style={pill(selectedStore === "all")}>
          All ({totalRemaining})
        </button>
        {STORE_KEYS.map((key) => (
          <button key={key} onClick={() => setSelectedStore(key)} style={pill(selectedStore === key)}>
            {STORE_LABELS[key]} ({storeCounts[key] ?? 0})
          </button>
        ))}
      </div>

      {/* Action buttons — only when there are unchecked items */}
      {totalRemaining > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button
            onClick={handleCopy}
            style={{
              borderRadius: 50, padding: "8px 16px", fontSize: 12,
              fontWeight: 600, border: "1.5px solid #E8621A",
              background: copied ? "#E8621A" : "#fff",
              color: copied ? "#fff" : "#E8621A",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {copied ? "✓ Copied!" : "📋 Copy list"}
          </button>
          <button
            onClick={handleWhatsApp}
            style={{
              borderRadius: 50, padding: "8px 16px", fontSize: 12,
              fontWeight: 600, border: "1.5px solid #25D366",
              background: "#fff", color: "#25D366",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            💬 Share on WhatsApp
          </button>
        </div>
      )}

      {/* Items */}
      {displayed.length === 0 ? (
        <p style={{ color: "#999", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
          No items for this store yet.
        </p>
      ) : (
        displayed.map((item) => {
          const isChecked = checkedIds.has(item.id);
          const sk = item.resolvedStore as StoreKey;
          const badgeColors: Record<StoreKey, { bg: string; color: string }> = {
            woolworths: { bg: "#FDE8E0", color: "#C0430E" },
            pnp: { bg: "#E8F5E9", color: "#2E7D32" },
            checkers: { bg: "#E6F1FB", color: "#185FA5" },
          };
          const badge = badgeColors[sk];
          const qty = item.quantity != null ? String(item.quantity) : "";
          const qtyLabel = [qty, item.unit].filter(Boolean).join(" ");

          return (
            <div
              key={item.id}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 0", borderBottom: "1px solid #F5EEE8",
                cursor: "pointer", opacity: isChecked ? 0.45 : 1,
              }}
            >
              {/* Checkbox */}
              <div
                onClick={() => toggle(item.id)}
                style={{
                  width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                  border: "2px solid", display: "flex", alignItems: "center", justifyContent: "center",
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
                onClick={() => toggle(item.id)}
                style={{
                  flex: 1, fontSize: 13, fontWeight: 500,
                  color: isChecked ? "#bbb" : "#1A1A1A",
                  textDecoration: isChecked ? "line-through" : "none",
                }}
              >
                {item.ingredient_name}
              </span>

              {/* Qty */}
              {qtyLabel && (
                <span style={{ fontSize: 12, color: "#999", flexShrink: 0 }}>{qtyLabel}</span>
              )}

              {/* Store badge */}
              <span style={{
                fontSize: 10, fontWeight: 600, borderRadius: 50,
                padding: "2px 8px", flexShrink: 0,
                background: badge.bg, color: badge.color,
              }}>
                {STORE_LABELS[sk]}
              </span>

              {/* External search link */}
              <a
                href={STORE_SEARCH[sk](item.ingredient_name)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ flexShrink: 0, color: "#bbb", lineHeight: 0 }}
                aria-label={`Search ${item.ingredient_name}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          );
        })
      )}
    </div>
  );
}
