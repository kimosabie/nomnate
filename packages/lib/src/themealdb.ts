const BASE = "https://www.themealdb.com/api/json/v1/1";

export type MealDBMeal = {
  idMeal: string;
  strMeal: string;
  strCategory: string | null;
  strArea: string | null;
  strInstructions: string | null;
  strMealThumb: string | null;
  [key: string]: string | null | undefined;
};

export type MealDBListItem = {
  idMeal: string;
  strMeal: string;
  strMealThumb: string | null;
};

export type MealDBIngredient = {
  name: string;
  measure: string;
};

export function extractIngredients(meal: MealDBMeal): MealDBIngredient[] {
  const ingredients: MealDBIngredient[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`]?.trim();
    const measure = meal[`strMeasure${i}`]?.trim() ?? "";
    if (name) ingredients.push({ name, measure });
  }
  return ingredients;
}

export async function searchMealDB(query: string): Promise<MealDBMeal[]> {
  const res = await fetch(
    `${BASE}/search.php?s=${encodeURIComponent(query)}`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) throw new Error(`TheMealDB error: ${res.status}`);
  const data = await res.json();
  return (data.meals as MealDBMeal[]) ?? [];
}

export async function getSAMeals(): Promise<MealDBListItem[]> {
  const res = await fetch(`${BASE}/filter.php?a=South%20African`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`TheMealDB error: ${res.status}`);
  const data = await res.json();
  return (data.meals as MealDBListItem[]) ?? [];
}

export async function lookupMealDB(id: string): Promise<MealDBMeal | null> {
  const res = await fetch(`${BASE}/lookup.php?i=${id}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`TheMealDB error: ${res.status}`);
  const data = await res.json();
  return (data.meals?.[0] as MealDBMeal) ?? null;
}
