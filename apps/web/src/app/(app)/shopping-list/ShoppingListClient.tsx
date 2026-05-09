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

export function ShoppingListClient({ initialItems }: { initialItems: Item[] }) {
  const [, startTransition] = useTransition();

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

  const [copyFeedback, setCopyFeedback] = useState<StoreKey | null>(null);

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

  const copyStoreList = useCallback(
    (storeKey: StoreKey) => {
      const storeItems = items
        .filter((i) => !i.checked && resolveStore(i) === storeKey)
        .map((i) => {
          const parts = [
            i.quantity != null ? String(i.quantity) : null,
            i.unit,
            i.ingredient_name,
          ].filter(Boolean);
          return `• ${parts.join(" ")}`;
        });

      if (!storeItems.length) return;

      const store = STORES.find((s) => s.key === storeKey);
      const text = `${store?.label ?? storeKey} shopping list:\n${storeItems.join("\n")}`;
      navigator.clipboard.writeText(text).then(() => {
        setCopyFeedback(storeKey);
        setTimeout(() => setCopyFeedback(null), 2000);
      });
    },
    [items]
  );

  const withStore: ItemWithStore[] = items.map((i) => ({
    ...i,
    resolvedStore: resolveStore(i),
  }));

  const totalRemaining = withStore.filter((i) => !i.checked).length;

  return (
    <div className="space-y-4">
      {totalRemaining === 0 && (
        <div className="bg-white rounded-[14px] border border-gray-200 px-6 py-10 text-center">
          <p className="text-2xl mb-2">&#127881;</p>
          <p className="text-sm font-semibold text-charcoal mb-1">All done!</p>
          <p className="text-xs text-slate">
            Everything is in the trolley. Enjoy cooking!
          </p>
        </div>
      )}

      {/* Store copy buttons */}
      {totalRemaining > 0 && (
        <div className="flex flex-wrap gap-2">
          {STORES.map((store) => {
            const count = withStore.filter(
              (i) => !i.checked && i.resolvedStore === store.key
            ).length;
            if (count === 0) return null;
            const copied = copyFeedback === store.key;
            return (
              <button
                key={store.key}
                onClick={() => copyStoreList(store.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                  copied
                    ? "bg-herb-light border-herb text-herb"
                    : "bg-white border-gray-200 text-slate hover:bg-cream hover:border-flame hover:text-flame"
                }`}
              >
                {copied ? "✓ Copied" : `Copy ${store.label} list (${count})`}
              </button>
            );
          })}
        </div>
      )}

      {/* Flat ingredient list */}
      <div className="bg-white rounded-[14px] border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {withStore.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onToggle={handleToggle}
              onStoreChange={handleStoreChange}
            />
          ))}
        </div>
      </div>
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
  const label = [
    item.quantity != null ? item.quantity : null,
    item.unit,
    item.ingredient_name,
  ]
    .filter(Boolean)
    .join(" ");

  const store = STORES.find((s) => s.key === item.resolvedStore)!;
  const searchUrl = store.searchUrl(item.ingredient_name);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-opacity ${
        item.checked ? "opacity-40" : ""
      }`}
    >
      {/* Checkbox */}
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

      {/* Label */}
      <p
        className={`flex-1 text-sm font-medium text-charcoal min-w-0 truncate ${
          item.checked ? "line-through" : ""
        }`}
      >
        {label}
      </p>

      {/* Store picker */}
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

      {/* Search link */}
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
