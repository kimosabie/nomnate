import type { StoreLinks } from "@nomnate/types";

const STORE_BASE: Record<keyof StoreLinks, string> = {
  woolworths: "https://www.woolworths.co.za/cat?Ntt=",
  checkers: "https://www.sixty60.co.za/search?q=",
  pnp: "https://www.pnp.co.za/pnpstorefront/search?q=",
};

export function getStoreLinks(ingredient: string): StoreLinks {
  const encoded = encodeURIComponent(ingredient.trim());
  return {
    woolworths: `${STORE_BASE.woolworths}${encoded}`,
    checkers: `${STORE_BASE.checkers}${encoded}`,
    pnp: `${STORE_BASE.pnp}${encoded}`,
  };
}

export function getShoppingListStoreLinks(
  ingredients: string[]
): Record<string, StoreLinks> {
  return Object.fromEntries(
    ingredients.map((name) => [name, getStoreLinks(name)])
  );
}
