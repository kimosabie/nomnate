export interface Store {
  key: string;
  label: string;
  emoji: string;
}

const ZA_STORES: Store[] = [
  { key: "woolworths", label: "Woolworths", emoji: "🟢" },
  { key: "pnp", label: "Pick n Pay", emoji: "🔴" },
  { key: "checkers", label: "Checkers", emoji: "🔵" },
];

const UK_STORES: Store[] = [
  { key: "waitrose", label: "Waitrose", emoji: "🟢" },
  { key: "sainsburys", label: "Sainsbury's", emoji: "🟠" },
  { key: "marks_spencer", label: "M&S Food", emoji: "⚫" },
  { key: "tesco", label: "Tesco", emoji: "🔵" },
];

const FR_STORES: Store[] = [
  { key: "auchan", label: "Auchan", emoji: "🟠" },
  { key: "carrefour", label: "Carrefour", emoji: "🔵" },
  { key: "monoprix", label: "Monoprix", emoji: "🟡" },
  { key: "lidl", label: "Lidl", emoji: "🔴" },
];

export function getStoresForCountry(country: string | null | undefined): Store[] {
  switch (country) {
    case "UK": return UK_STORES;
    case "FR": return FR_STORES;
    default: return ZA_STORES;
  }
}

export function getStoreLabel(key: string, country: string | null | undefined): string {
  const store = getStoresForCountry(country).find((s) => s.key === key);
  return store?.label ?? key;
}
