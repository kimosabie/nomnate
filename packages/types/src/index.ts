// ─── Enums ────────────────────────────────────────────────────────────────────

export type RecipeSource = "ai" | "spoonacular" | "manual";

export type SlotStatus = "suggested" | "voted" | "confirmed";

export type VoteValue = "up" | "down" | "love";

export type MemberRole = "admin" | "member";

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type DietaryRestriction =
  | "vegetarian"
  | "vegan"
  | "gluten-free"
  | "dairy-free"
  | "nut-free"
  | "halal"
  | "kosher";

export const DIETARY_RESTRICTIONS: DietaryRestriction[] = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "dairy-free",
  "nut-free",
  "halal",
  "kosher",
];

// ─── Domain types (app-level, not raw DB rows) ────────────────────────────────

export interface Family {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  dietary_restrictions: string[];
  role: MemberRole;
  joined_at: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface Recipe {
  id: string;
  family_id: string | null;
  title: string;
  source: RecipeSource;
  instructions: string | null;
  image_url: string | null;
  prep_time: number | null;
  cuisine: string | null;
  is_favourite: boolean;
  spoonacular_id: number | null;
  created_by: string | null;
  created_at: string;
  ingredients?: RecipeIngredient[];
}

export interface MealPlan {
  id: string;
  family_id: string;
  week_start_date: string;
  created_at: string;
}

export interface MealPlanSlot {
  id: string;
  meal_plan_id: string;
  day_of_week: DayOfWeek;
  recipe_id: string | null;
  status: SlotStatus;
  recipe?: Recipe;
  votes?: Vote[];
}

export interface Vote {
  id: string;
  meal_plan_slot_id: string;
  member_id: string;
  value: VoteValue;
  created_at: string;
}

export interface ShoppingList {
  id: string;
  meal_plan_id: string;
  generated_at: string;
  items?: ShoppingListItem[];
}

export interface ShoppingListItem {
  id: string;
  list_id: string;
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
}

// ─── Store links ──────────────────────────────────────────────────────────────

export interface StoreLinks {
  woolworths: string;
  checkers: string;
  pnp: string;
}

// ─── Claude / AI types ────────────────────────────────────────────────────────

export interface MealSuggestionParams {
  familySize: number;
  dietaryRestrictions: string[];
  cuisine?: string;
  excludeTitles?: string[];
  count?: number;
}

export interface SuggestedRecipe {
  title: string;
  cuisine: string;
  prep_time: number;
  instructions: string;
  ingredients: Array<{
    name: string;
    quantity: number | null;
    unit: string | null;
  }>;
}

// ─── Spoonacular types ────────────────────────────────────────────────────────

export interface SpoonacularRecipe {
  id: number;
  title: string;
  image: string;
  readyInMinutes: number;
  cuisines: string[];
  instructions: string;
  extendedIngredients: Array<{
    id: number;
    name: string;
    amount: number;
    unit: string;
  }>;
}
