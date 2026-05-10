"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { STORES, StoreKey, assignStore } from "./storeUtils";

interface ShoppingItem {
  id: string;
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
  store: string | null;
}

type MutableItem = Omit<ShoppingItem, "store"> & { effectiveStore: StoreKey };

const STORE_CYCLE: StoreKey[] = ["woolworths", "pnp", "checkers"];
const VALID_STORES = new Set<string>(STORE_CYCLE);

function toStoreKey(raw: string | null, name: string): StoreKey {
  if (raw && VALID_STORES.has(raw)) return raw as StoreKey;
  return assignStore(name);
}

function storeInfo(key: StoreKey) {
  return STORES.find((s) => s.key === key) ?? STORES[2];
}

export function ShoppingListClient({ initialItems }: { initialItems: ShoppingItem[] }) {
  const [items, setItems] = useState<MutableItem[]>(() =>
    initialItems.map((i) => ({
      ...i,
      effectiveStore: toStoreKey(i.store, i.ingredient_name),
    }))
  );
  const [selectedStore, setSelectedStore] = useState<"all" | StoreKey>("all");
  const [copied, setCopied] = useState(false);

  async function handleToggle(id: string, currentChecked: boolean) {
    const newChecked = !currentChecked;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked: newChecked } : i)));
    createClient().from("shopping_list_items").update({ checked: newChecked }).eq("id", id);
  }

  async function handleCycleStore(id: string, currentStore: StoreKey) {
    const idx = STORE_CYCLE.indexOf(currentStore);
    const next = STORE_CYCLE[(idx + 1) % STORE_CYCLE.length];
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, effectiveStore: next } : i)));
    createClient().from("shopping_list_items").update({ store: next }).eq("id", id);
  }

  const storeCounts = Object.fromEntries(
    STORES.map((s) => [
      s.key,
      items.filter((i) => !i.checked && i.effectiveStore === s.key).length,
    ])
  ) as Record<StoreKey, number>;

  const totalUnchecked = items.filter((i) => !i.checked).length;

  const displayed =
    selectedStore === "all" ? items : items.filter((i) => i.effectiveStore === selectedStore);

  const uncheckedInView = displayed.filter((i) => !i.checked);

  function buildText(label: string, whatsapp: boolean) {
    const lines = uncheckedInView.map((i) => {
      const qty = [i.quantity != null ? String(i.quantity) : "", i.unit].filter(Boolean).join(" ");
      return `${whatsapp ? "•" : "□"} ${i.ingredient_name}${qty ? ` — ${qty}` : ""}`;
    });
    const header = whatsapp
      ? `🍽️ *NomNate Shopping List*\n🛒 *${label}*\n─────────────────────`
      : `NomNate Shopping List — ${label}\n─────────────────────`;
    const footer = whatsapp ? "\n\n_Shared from NomNate_" : "\n\nShared from NomNate";
    return `${header}\n${lines.join("\n")}${footer}`;
  }

  function handleCopy() {
    if (!uncheckedInView.length) return;
    const label = selectedStore === "all" ? "Full list" : storeInfo(selectedStore).label;
    navigator.clipboard?.writeText(buildText(label, false)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function handleWhatsApp() {
    if (!uncheckedInView.length) return;
    const label = selectedStore === "all" ? "Full list" : storeInfo(selectedStore).label;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(buildText(label, true))}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <div className="space-y-3">
      {/* Store filter tabs */}
      <div className="bg-white rounded-[14px] border border-cream-border px-4 py-3">
        <p className="text-[11px] text-slate font-semibold uppercase tracking-wide mb-2">
          Shop by store
        </p>
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

      {/* Share actions */}
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

      {/* Item list */}
      <div className="bg-white rounded-[14px] border border-cream-border overflow-hidden">
        {displayed.length === 0 ? (
          <p className="text-sm text-slate text-center py-8">No items for this store.</p>
        ) : (
          <ul className="divide-y divide-cream-border">
            {displayed.map((item) => {
              const store = storeInfo(item.effectiveStore);
              const qty = [item.quantity != null ? String(item.quantity) : "", item.unit]
                .filter(Boolean)
                .join(" ");

              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ opacity: item.checked ? 0.4 : 1 }}
                >
                  <button
                    type="button"
                    onClick={() => handleToggle(item.id, item.checked)}
                    className="w-5 h-5 rounded-[5px] flex-shrink-0 flex items-center justify-center border-2 transition-colors"
                    style={{
                      borderColor: item.checked ? "#E8621A" : "#F5D5C0",
                      background: item.checked ? "#E8621A" : "#fff",
                    }}
                    aria-label={item.checked ? "Uncheck" : "Mark as got"}
                  >
                    {item.checked && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path
                          d="M1.5 5l2.5 2.5 4.5-4.5"
                          stroke="#fff"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>

                  <span
                    className="flex-1 text-sm font-medium cursor-pointer select-none"
                    style={{
                      color: item.checked ? "#bbb" : "#1A1A1A",
                      textDecoration: item.checked ? "line-through" : "none",
                    }}
                    onClick={() => handleToggle(item.id, item.checked)}
                  >
                    {item.ingredient_name}
                  </span>

                  {qty && (
                    <span className="text-xs text-slate flex-shrink-0">{qty}</span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleCycleStore(item.id, item.effectiveStore)}
                    title="Tap to change store"
                    className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${store.badgeBg} ${store.badgeText}`}
                  >
                    {store.label}
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4 8a4 4 0 1 1 8 0M12 4v4h-4" />
                    </svg>
                  </button>

                  <a
                    href={store.searchUrl(item.ingredient_name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-slate hover:text-flame transition-colors"
                    aria-label={`Search at ${store.label}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
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
              {selectedStore === "all"
                ? "All done — great shop!"
                : `Done at ${storeInfo(selectedStore).label}!`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
