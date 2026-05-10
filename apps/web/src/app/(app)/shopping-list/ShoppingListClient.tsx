"use client";

import { useState, useCallback } from "react";
import { STORES, StoreKey, assignStore } from "./storeUtils";
import { toggleItem, setItemStore } from "./actions";

interface ShoppingItem {
  id: string;
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
  store: string | null;
}

const STORE_CYCLE: StoreKey[] = ["woolworths", "pnp", "checkers"];

function formatLine(item: ShoppingItem, qty: string): string {
  return qty ? `□ ${item.ingredient_name} — ${qty}` : `□ ${item.ingredient_name}`;
}

export function ShoppingListClient({ initialItems }: { initialItems: ShoppingItem[] }) {
  const [selectedStore, setSelectedStore] = useState<"all" | StoreKey>("all");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    () => new Set(initialItems.filter((i) => i.checked).map((i) => i.id))
  );
  const [itemStores, setItemStores] = useState<Map<string, StoreKey>>(() => {
    const m = new Map<string, StoreKey>();
    for (const item of initialItems) {
      m.set(item.id, (item.store as StoreKey) ?? assignStore(item.ingredient_name));
    }
    return m;
  });
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

  const cycleStore = useCallback((id: string) => {
    setItemStores((prev) => {
      const current = prev.get(id) ?? "checkers";
      const idx = STORE_CYCLE.indexOf(current);
      const next = STORE_CYCLE[(idx + 1) % STORE_CYCLE.length];
      const newMap = new Map(prev);
      newMap.set(id, next);
      setItemStore(id, next);
      return newMap;
    });
  }, []);

  // Per-store counts (unchecked only)
  const storeCounts = Object.fromEntries(
    STORES.map((s) => [
      s.key,
      initialItems.filter((i) => !checkedIds.has(i.id) && itemStores.get(i.id) === s.key).length,
    ])
  ) as Record<StoreKey, number>;

  const totalUnchecked = initialItems.filter((i) => !checkedIds.has(i.id)).length;

  const displayed =
    selectedStore === "all"
      ? initialItems
      : initialItems.filter((i) => itemStores.get(i.id) === selectedStore);

  const uncheckedInView = displayed.filter((i) => !checkedIds.has(i.id));

  const sm = (key: StoreKey) => STORES.find((s) => s.key === key)!;

  function buildShareText(label: string) {
    const lines = uncheckedInView.map((i) => {
      const qty = [i.quantity != null ? String(i.quantity) : "", i.unit].filter(Boolean).join(" ");
      return formatLine(i, qty);
    });
    return `NomNate Shopping List — ${label}\n─────────────────────\n${lines.join("\n")}\n\nShared from NomNate`;
  }

  function handleCopy() {
    if (!uncheckedInView.length) return;
    const label = selectedStore === "all" ? "Full list" : sm(selectedStore).label;
    const text = buildShareText(label);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }
  }

  function handleWhatsApp() {
    if (!uncheckedInView.length) return;
    const label = selectedStore === "all" ? "Full list" : sm(selectedStore).label;
    const lines = uncheckedInView.map((i) => {
      const qty = [i.quantity != null ? String(i.quantity) : "", i.unit].filter(Boolean).join(" ");
      return formatLine(i, qty);
    });
    const text = `🍽️ *NomNate Shopping List*\n🛒 *${label}*\n─────────────────────\n${lines.join("\n")}\n\n_Shared from NomNate_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-3">
      {/* Store radio tabs */}
      <div className="bg-white rounded-[14px] border border-cream-border px-4 py-3">
        <p className="text-[11px] text-slate font-semibold uppercase tracking-wide mb-2">Shop by store</p>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedStore("all")}
            className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
            style={{
              borderColor: selectedStore === "all" ? "#E8621A" : "#F5D5C0",
              background: selectedStore === "all" ? "#E8621A" : "#fff",
              color: selectedStore === "all" ? "#fff" : "#777",
            }}
          >
            All ({totalUnchecked})
          </button>
          {STORES.map((s) => (
            <button
              type="button"
              key={s.key}
              onClick={() => setSelectedStore(s.key)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
              style={{
                borderColor: selectedStore === s.key ? "#E8621A" : "#F5D5C0",
                background: selectedStore === s.key ? "#E8621A" : "#fff",
                color: selectedStore === s.key ? "#fff" : "#777",
              }}
            >
              {s.label} ({storeCounts[s.key] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      {uncheckedInView.length > 0 && (
        <div className="flex gap-2 flex-wrap">
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

      {/* Master list */}
      <div className="bg-white rounded-[14px] border border-cream-border overflow-hidden">
        {displayed.length === 0 ? (
          <p className="text-sm text-slate text-center py-8">No items for this store.</p>
        ) : (
          <ul className="divide-y divide-cream-border">
            {displayed.map((item) => {
              const isChecked = checkedIds.has(item.id);
              const storeKey = itemStores.get(item.id) ?? "checkers";
              const store = sm(storeKey);
              const qty = [item.quantity != null ? String(item.quantity) : "", item.unit]
                .filter(Boolean)
                .join(" ");

              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ opacity: isChecked ? 0.4 : 1 }}
                >
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    className="w-5 h-5 rounded-[5px] flex-shrink-0 flex items-center justify-center border-2 transition-colors"
                    style={{
                      borderColor: isChecked ? "#E8621A" : "#F5D5C0",
                      background: isChecked ? "#E8621A" : "#fff",
                    }}
                    aria-label={isChecked ? "Uncheck" : "Check off"}
                  >
                    {isChecked && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  {/* Name */}
                  <span
                    className="flex-1 text-sm font-medium cursor-pointer select-none"
                    style={{
                      color: isChecked ? "#bbb" : "#1A1A1A",
                      textDecoration: isChecked ? "line-through" : "none",
                    }}
                    onClick={() => toggle(item.id)}
                  >
                    {item.ingredient_name}
                  </span>

                  {/* Qty */}
                  {qty && <span className="text-xs text-slate flex-shrink-0">{qty}</span>}

                  {/* Store cycle button — tap to change store */}
                  <button
                    type="button"
                    onClick={() => cycleStore(item.id)}
                    title="Tap to change store"
                    className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${store.badgeBg} ${store.badgeText}`}
                  >
                    {store.label}
                    <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 8a4 4 0 1 1 8 0M12 4v4h-4" />
                    </svg>
                  </button>

                  {/* Search at this store */}
                  <a
                    href={store.searchUrl(item.ingredient_name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-slate hover:text-flame transition-colors"
                    aria-label={`Search at ${store.label}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </li>
              );
            })}
          </ul>
        )}

        {displayed.length > 0 && uncheckedInView.length === 0 && (
          <div className="p-5 text-center border-t border-cream-border">
            <p className="text-xl mb-0.5">✅</p>
            <p className="text-xs font-semibold text-charcoal">
              {selectedStore === "all" ? "All done — great shop!" : `Done at ${sm(selectedStore).label}!`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
