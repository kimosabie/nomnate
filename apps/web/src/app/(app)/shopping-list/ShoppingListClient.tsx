"use client";

import { useTransition, useState } from "react";
import { toggleItem, setItemStore } from "./actions";
import { assignStore, STORES, type StoreKey } from "./storeUtils";

type Item = {
  id: string;
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
  store: string | null;
};

type ItemWithStore = Item & { resolvedStore: StoreKey };

function resolveStore(item: Item): StoreKey {
  if (item.store && ["woolworths", "pnp", "checkers"].includes(item.store)) {
    return item.store as StoreKey;
  }
  return assignStore(item.ingredient_name);
}

function formatItemLine(item: Item): string {
  const qty = item.quantity != null ? `${item.quantity}` : "";
  const unit = item.unit ?? "";
  const suffix = [qty, unit].filter(Boolean).join(" ");
  return suffix
    ? `□ ${item.ingredient_name} — ${suffix}`
    : `□ ${item.ingredient_name}`;
}

export function ShoppingListClient({ initialItems }: { initialItems: Item[] }) {
  const [, startTransition] = useTransition();
  const [activeStore, setActiveStore] = useState<StoreKey | "all">("all");
  const [copied, setCopied] = useState(false);
  const [items, setItems] = useState<Item[]>(initialItems);

  function handleToggle(id: string, checked: boolean) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked } : i)));
    startTransition(async () => {
      await toggleItem(id, checked);
    });
  }

  function handleStoreChange(id: string, store: StoreKey) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, store } : i)));
    startTransition(async () => {
      await setItemStore(id, store);
    });
  }

  const withStore: ItemWithStore[] = items.map((i) => ({
    ...i,
    resolvedStore: resolveStore(i),
  }));

  const storeCounts = STORES.reduce<Record<StoreKey, number>>(
    (acc, s) => {
      acc[s.key] = withStore.filter((i) => !i.checked && i.resolvedStore === s.key).length;
      return acc;
    },
    { woolworths: 0, pnp: 0, checkers: 0 }
  );
  const totalRemaining = withStore.filter((i) => !i.checked).length;

  const displayed =
    activeStore === "all"
      ? withStore
      : withStore.filter((i) => i.resolvedStore === activeStore);

  const storeLabel =
    activeStore === "all"
      ? "All stores"
      : STORES.find((s) => s.key === activeStore)?.label ?? activeStore;

  function copyList() {
    const unchecked = displayed.filter((i) => !i.checked);
    if (!unchecked.length) return;
    const header = `NomNate Shopping List — ${storeLabel}`;
    const divider = "─".repeat(Math.min(header.length, 40));
    const lines = unchecked.map(formatItemLine);
    const text = `${header}\n${divider}\n${lines.join("\n")}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareWhatsApp() {
    const unchecked = displayed.filter((i) => !i.checked);
    if (!unchecked.length) return;
    const header = `🍽️ NomNate Shopping List`;
    const storeLine = `🛒 ${storeLabel}`;
    const divider = "─────────────────────";
    const lines = unchecked.map(formatItemLine);
    const footer = "\n\nShared from NomNate — nomnate.co.za";
    const text = `${header}\n${storeLine}\n${divider}\n${lines.join("\n")}${footer}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }

  return (
    <div className="space-y-4">
      {/* Store filter + actions */}
      <div className="bg-white rounded-[14px] border border-cream-border p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveStore("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              activeStore === "all"
                ? "bg-flame border-flame text-white"
                : "bg-white border-cream-border text-slate hover:border-flame hover:text-flame"
            }`}
          >
            All ({totalRemaining})
          </button>
          {STORES.map((store) => (
            <button
              key={store.key}
              onClick={() => setActiveStore(store.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                activeStore === store.key
                  ? "bg-flame border-flame text-white"
                  : "bg-white border-cream-border text-slate hover:border-flame hover:text-flame"
              }`}
            >
              {store.label} ({storeCounts[store.key]})
            </button>
          ))}
        </div>

        {totalRemaining > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={copyList}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                copied
                  ? "bg-herb-light border-herb text-herb"
                  : "bg-white border-flame text-flame hover:bg-flame-light"
              }`}
            >
              {copied
                ? "✓ Copied"
                : activeStore === "all"
                ? "Copy full list"
                : `Copy ${storeLabel} list`}
            </button>
            <button
              onClick={shareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-[#25D366] text-[#25D366] bg-white hover:bg-[#E8F5E9] transition-colors"
            >
              Share on WhatsApp
            </button>
          </div>
        )}
      </div>

      {totalRemaining === 0 ? (
        <div className="bg-white rounded-[14px] border border-cream-border px-6 py-10 text-center">
          <p className="text-2xl mb-2">🎉</p>
          <p className="text-sm font-semibold text-charcoal mb-1">All done!</p>
          <p className="text-xs text-slate">Everything is in the trolley. Enjoy cooking!</p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-[14px] border border-cream-border px-6 py-8 text-center">
          <p className="text-sm text-slate">No items assigned to this store yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-[14px] border border-cream-border overflow-hidden">
          <div className="divide-y divide-cream-border/40">
            {displayed.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onToggle={handleToggle}
                onStoreChange={handleStoreChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  onToggle,
  onStoreChange,
}: {
  item: ItemWithStore;
  onToggle: (id: string, checked: boolean) => void;
  onStoreChange: (id: string, store: StoreKey) => void;
}) {
  const store = STORES.find((s) => s.key === item.resolvedStore)!;
  const searchUrl = store.searchUrl(item.ingredient_name);

  const label = [
    item.quantity != null ? item.quantity : null,
    item.unit,
    item.ingredient_name,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-opacity ${
        item.checked ? "opacity-40" : ""
      }`}
    >
      <button
        onClick={() => onToggle(item.id, !item.checked)}
        className={`w-5 h-5 rounded-md shrink-0 border-2 flex items-center justify-center transition-colors ${
          item.checked
            ? "bg-flame border-flame text-white"
            : "border-cream-border hover:border-flame"
        }`}
        aria-label={item.checked ? "Uncheck item" : "Check item"}
      >
        {item.checked && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12">
            <path
              d="M2 6l3 3 5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <p
        className={`flex-1 text-sm font-medium text-charcoal min-w-0 truncate ${
          item.checked ? "line-through" : ""
        }`}
      >
        {label}
      </p>

      <select
        value={item.resolvedStore}
        onChange={(e) => onStoreChange(item.id, e.target.value as StoreKey)}
        className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-flame-light ${store.badgeBg} ${store.badgeText}`}
        aria-label="Select store"
        disabled={item.checked}
      >
        {STORES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>

      <a
        href={searchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-slate hover:text-charcoal transition-colors"
        aria-label={`Search for ${item.ingredient_name}`}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </a>
    </div>
  );
}
