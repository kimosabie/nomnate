"use client";

import { useOptimistic, useTransition } from "react";
import { toggleItem } from "./actions";
import { assignStore, STORES } from "./storeUtils";

type Item = {
  id: string;
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
};

export function ShoppingListClient({ initialItems }: { initialItems: Item[] }) {
  const [, startTransition] = useTransition();
  const [items, setOptimistic] = useOptimistic(
    initialItems,
    (state, { id, checked }: { id: string; checked: boolean }) =>
      state.map((i) => (i.id === id ? { ...i, checked } : i))
  );

  function handleToggle(id: string, checked: boolean) {
    startTransition(async () => {
      setOptimistic({ id, checked });
      await toggleItem(id, checked);
    });
  }

  const totalRemaining = items.filter((i) => !i.checked).length;

  return (
    <div className="space-y-4">
      {totalRemaining === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center">
          <p className="text-2xl mb-2">🎉</p>
          <p className="text-sm font-semibold text-gray-900 mb-1">All done!</p>
          <p className="text-xs text-gray-400">Everything is in the trolley. Enjoy cooking!</p>
        </div>
      )}

      {STORES.map((store) => {
        const storeItems = items.filter(
          (i) => assignStore(i.ingredient_name) === store.key
        );
        if (storeItems.length === 0) return null;

        const remaining = storeItems.filter((i) => !i.checked).length;

        return (
          <div
            key={store.key}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            {/* Store header */}
            <div
              className={`flex items-center justify-between px-4 py-3 ${store.headerBg}`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${store.headerText}`}>
                  {store.label}
                </span>
                {remaining > 0 && (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${store.countBg}`}
                  >
                    {remaining}
                  </span>
                )}
              </div>
              <a
                href={store.shopUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-xs font-semibold px-3 py-1 rounded-full bg-white/25 hover:bg-white/40 transition-colors ${store.headerText}`}
              >
                Shop ↗
              </a>
            </div>

            {/* Items */}
            <div className="divide-y divide-gray-50">
              {storeItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggle={handleToggle}
                  searchUrl={store.searchUrl(item.ingredient_name)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ItemRow({
  item,
  onToggle,
  searchUrl,
}: {
  item: Item;
  onToggle: (id: string, checked: boolean) => void;
  searchUrl: string;
}) {
  const label = [
    item.quantity != null ? item.quantity : null,
    item.unit,
    item.ingredient_name,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`flex items-center gap-3 px-4 py-3 transition-opacity ${item.checked ? "opacity-40" : ""}`}>
      <button
        onClick={() => onToggle(item.id, !item.checked)}
        className={`w-5 h-5 rounded shrink-0 border-2 flex items-center justify-center transition-colors ${
          item.checked
            ? "bg-orange-400 border-orange-400 text-white"
            : "border-gray-300 hover:border-orange-400"
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
        className={`flex-1 text-sm font-medium text-gray-900 min-w-0 truncate ${
          item.checked ? "line-through" : ""
        }`}
      >
        {label}
      </p>

      <a
        href={searchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
        aria-label={`Search for ${item.ingredient_name}`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  );
}
