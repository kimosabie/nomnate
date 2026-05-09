"use client";

import { useOptimistic, useTransition, useState, useCallback } from "react";
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

function itemLabel(item: Item): string {
  return [
    item.quantity != null ? item.quantity : null,
    item.unit,
    item.ingredient_name,
  ]
    .filter(Boolean)
    .join(" ");
}

export function ShoppingListClient({ initialItems }: { initialItems: Item[] }) {
  const [, startTransition] = useTransition();
  const [activeStore, setActiveStore] = useState<StoreKey | "all">("all");
  const [copyFeedback, setCopyFeedback] = useState(false);

  const [items, setOptimistic] = useOptimistic(
    initialItems,
    (
      state,
      update:
        | { type: "toggle"; id: string; checked: boolean }
        | { type: "store"; id: string; store: string | null }
    ) =>
      state.map((i) => {
        if (i.id !== update.id) return i;
        if (update.type === "toggle") return { ...i, checked: update.checked };
        if (update.type === "store") return { ...i, store: update.store };
        return i;
      })
  );

  function handleToggle(id: string, checked: boolean) {
    startTransition(async () => {
      setOptimistic({ type: "toggle", id, checked });
      await toggleItem(id, checked);
    });
  }

  function handleStoreChange(id: string, store: StoreKey) {
    startTransition(async () => {
      setOptimistic({ type: "store", id, store });
      await setItemStore(id, store);
    });
  }

  const withStore: ItemWithStore[] = items.map((i) => ({
    ...i,
    resolvedStore: resolveStore(i),
  }));

  // Count unchecked items per store
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

  const copyList = useCallback(() => {
    const storeLabel =
      activeStore === "all"
        ? "Shopping List"
        : `${STORES.find((s) => s.key === activeStore)?.label ?? activeStore} Shopping List`;

    const unchecked = displayed.filter((i) => !i.checked);
    if (!unchecked.length) return;

    const lines = unchecked.map((i) => `□ ${itemLabel(i)}`);
    const text = `${storeLabel}\n${"─".repeat(storeLabel.length)}\n${lines.join("\n")}`;

    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  }, [displayed, activeStore]);

  function shareWhatsApp() {
    const storeLabel =
      activeStore === "all"
        ? "Shopping List"
        : `${STORES.find((s) => s.key === activeStore)?.label ?? activeStore} Shopping List`;

    const unchecked = displayed.filter((i) => !i.checked);
    if (!unchecked.length) return;

    const lines = unchecked.map((i) => `□ ${itemLabel(i)}`);
    const text = `*${storeLabel}*\n${lines.join("\n")}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <div className="space-y-4">
      {/* Store filter tabs */}
      <div className="bg-white rounded-[14px] border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveStore("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              activeStore === "all"
                ? "bg-charcoal text-white"
                : "bg-cream text-slate hover:bg-cream-dark"
            }`}
          >
            All ({totalRemaining})
          </button>
          {STORES.map((store) => (
            <button
              key={store.key}
              onClick={() => setActiveStore(store.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeStore === store.key
                  ? "bg-charcoal text-white"
                  : "bg-cream text-slate hover:bg-cream-dark"
              }`}
            >
              {store.label} ({storeCounts[store.key]})
            </button>
          ))}
        </div>

        {/* Copy + WhatsApp actions */}
        {totalRemaining > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={copyList}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                copyFeedback
                  ? "bg-herb-light border-herb text-herb"
                  : "bg-white border-gray-200 text-slate hover:border-flame hover:text-flame"
              }`}
            >
              {copyFeedback
                ? "✓ Copied"
                : activeStore === "all"
                ? "Copy full list"
                : `Copy ${STORES.find((s) => s.key === activeStore)?.label ?? ""} list`}
            </button>
            <button
              onClick={shareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200 bg-white text-slate hover:border-[#25D366] hover:text-[#25D366] transition-colors"
            >
              Share on WhatsApp
            </button>
          </div>
        )}
      </div>

      {totalRemaining === 0 ? (
        <div className="bg-white rounded-[14px] border border-gray-200 px-6 py-10 text-center">
          <p className="text-2xl mb-2">&#127881;</p>
          <p className="text-sm font-semibold text-charcoal mb-1">All done!</p>
          <p className="text-xs text-slate">Everything is in the trolley. Enjoy cooking!</p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-[14px] border border-gray-200 px-6 py-8 text-center">
          <p className="text-sm text-slate">No items assigned to this store yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-[14px] border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
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
  const label = itemLabel(item);
  const store = STORES.find((s) => s.key === item.resolvedStore)!;
  const searchUrl = store.searchUrl(item.ingredient_name);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-opacity ${
        item.checked ? "opacity-40" : ""
      }`}
    >
      <button
        onClick={() => onToggle(item.id, !item.checked)}
        className={`w-5 h-5 rounded shrink-0 border-2 flex items-center justify-center transition-colors ${
          item.checked
            ? "bg-flame border-flame text-white"
            : "border-gray-300 hover:border-flame"
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
        className="shrink-0 text-gray-300 hover:text-slate transition-colors"
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
