"use client";

import { useOptimistic, useTransition } from "react";
import { toggleItem } from "./actions";

type Item = {
  id: string;
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
};

const STORES = [
  {
    label: "Woolworths",
    url: (q: string) =>
      `https://www.woolworths.co.za/cat?Ntt=${encodeURIComponent(q)}`,
    color: "text-[#4a3728] bg-[#f5f0eb] hover:bg-[#ece4db]",
  },
  {
    label: "Sixty60",
    url: (q: string) =>
      `https://www.sixty60.co.za/search?q=${encodeURIComponent(q)}`,
    color: "text-[#1a1a1a] bg-[#ffe600] hover:bg-[#f5dc00]",
  },
  {
    label: "Pick n Pay",
    url: (q: string) =>
      `https://www.pnp.co.za/pnpstorefront/search?q=${encodeURIComponent(q)}`,
    color: "text-white bg-[#e2001a] hover:bg-[#c9001a]",
  },
] as const;

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

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  return (
    <div className="space-y-6">
      {/* Unchecked items */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {unchecked.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">
            All items checked off — enjoy cooking!
          </p>
        ) : (
          unchecked.map((item) => (
            <ItemRow key={item.id} item={item} onToggle={handleToggle} />
          ))
        )}
      </div>

      {/* Checked items */}
      {checked.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              In the trolley ({checked.length})
            </p>
          </div>
          {checked.map((item) => (
            <ItemRow key={item.id} item={item} onToggle={handleToggle} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  onToggle,
}: {
  item: Item;
  onToggle: (id: string, checked: boolean) => void;
}) {
  const label = [
    item.quantity != null ? item.quantity : null,
    item.unit,
    item.ingredient_name,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`px-4 py-3 ${item.checked ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggle(item.id, !item.checked)}
          className={`mt-0.5 w-5 h-5 rounded shrink-0 border-2 flex items-center justify-center transition-colors ${
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

        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium text-gray-900 ${item.checked ? "line-through" : ""}`}
          >
            {label}
          </p>

          {!item.checked && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {STORES.map((store) => (
                <a
                  key={store.label}
                  href={store.url(item.ingredient_name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${store.color}`}
                >
                  {store.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
