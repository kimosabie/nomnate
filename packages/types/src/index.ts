// ─── Enums ────────────────────────────────────────────────────────────────────

export type RecipeSource = "ai" | "spoonacular" | "manual" | "prescribed" | "themealdb" | "web_reference";

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

export type DietType =
  | "balanced"
  | "keto"
  | "paleo"
  | "vegetarian"
  | "vegan"
  | "mediterranean"
  | "intermittent"
  | "low-carb"
  | "dash"
  | "gluten-free"
  | "raw-food"
  | "carnivore"
  | "flexitarian"
  | "whole30"
  | "zone";

export const DIET_TYPES: DietType[] = [
  "balanced",
  "keto",
  "paleo",
  "vegetarian",
  "vegan",
  "mediterranean",
  "intermittent",
  "low-carb",
  "dash",
  "gluten-free",
  "raw-food",
  "carnivore",
  "flexitarian",
  "whole30",
  "zone",
];

export const DIET_TYPE_LABELS: Record<DietType, string> = {
  balanced: "Balanced",
  keto: "Keto",
  paleo: "Paleo",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  mediterranean: "Mediterranean",
  intermittent: "Intermittent Fasting",
  "low-carb": "Low-Carb",
  dash: "DASH",
  "gluten-free": "Gluten-Free",
  "raw-food": "Raw Food",
  carnivore: "Carnivore",
  flexitarian: "Flexitarian",
  whole30: "Whole30",
  zone: "Zone",
};

export const CUISINES = [
  "South African",
  "Italian",
  "Indian",
  "Asian",
  "Mexican",
  "Mediterranean",
  "Middle Eastern",
  "American",
  "French",
  "Thai",
  "Japanese",
  "Greek",
  "Portuguese",
  "Chinese",
] as const;

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
  diet_types: string[];
  daily_calorie_target: number | null;
  track_calories: boolean;
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
  description: string | null;
  source: RecipeSource;
  instructions: string | null;
  image_url: string | null;
  prep_time: number | null;
  cook_time: number | null;
  servings: number | null;
  cuisine: string | null;
  diet_types: string[];
  calories_per_serving: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  is_favourite: boolean;
  is_global: boolean;
  external_id: string | null;
  source_url: string | null;
  source_attribution: string | null;
  spoonacular_id: number | null;
  themealdb_id: string | null;
  image_attribution: string | null;
  created_by: string | null;
  created_at: string;
  ingredients?: RecipeIngredient[];
}

export interface FamilyRecipe {
  id: string;
  family_id: string;
  recipe_id: string;
  added_by: string | null;
  added_at: string;
  is_favourite: boolean;
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

export interface FamilyMemberContext {
  relationship: string | null;
  age: number | null;
  dietaryRestrictions: string[];
  allergies: string[];
  dietTypes: string[];
  calorieTarget?: number | null;
}

export interface MealSuggestionParams {
  familySize: number;
  dietaryRestrictions: string[];
  cuisinePreferences?: string[];
  ingredientDislikes?: string[];
  likedIngredients?: string[];
  dietTypes?: string[];
  calorieTarget?: number | null;
  cuisine?: string;
  excludeTitles?: string[];
  count?: number;
  familyMembers?: FamilyMemberContext[];
  country?: string;
  familyDietaryRequirements?: string[];
  course?: string; // starter|main|dessert|side — biases the suggestion to that course
}

export interface SuggestedRecipe {
  title: string;
  cuisine: string;
  prep_time: number;
  instructions: string;
  calories_per_serving?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
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
  servings: number;
  cuisines: string[];
  diets: string[];
  dishTypes?: string[];
  instructions: string;
  summary?: string;
  extendedIngredients: Array<{
    id: number;
    name: string;
    amount: number;
    unit: string;
  }>;
  nutrition?: {
    nutrients: Array<{
      name: string;
      amount: number;
      unit: string;
    }>;
  };
}

// ─── Courses (B8) ─────────────────────────────────────────────────────────────

export type Course = "starter" | "main" | "dessert" | "side";

export const COURSE_TYPES: Course[] = ["starter", "main", "dessert", "side"];

export const COURSE_LABELS: Record<Course, string> = {
  starter: "Starter",
  main: "Main",
  dessert: "Dessert",
  side: "Side",
};

// Courses a family can opt a day into. `main` is always present and `side` is an
// internal classification target, so neither is user-selectable here.
export const SELECTABLE_COURSES: Course[] = ["starter", "main", "dessert"];

function isCourse(value: string): value is Course {
  return (COURSE_TYPES as string[]).includes(value);
}

// Map Spoonacular `dishTypes` (e.g. "dessert", "main course", "side dish",
// "appetizer", "soup", "salad") to a course. Returns null when nothing matches.
export function courseFromSpoonacularDishTypes(dishTypes: string[]): Course | null {
  const set = new Set(dishTypes.map((d) => d.toLowerCase().trim()));
  if (set.has("dessert")) return "dessert";
  if (["appetizer", "starter", "antipasti", "antipasto", "soup", "salad", "hor d'oeuvre"].some((t) => set.has(t)))
    return "starter";
  if (set.has("side dish")) return "side";
  if (["main course", "main dish", "lunch", "dinner"].some((t) => set.has(t))) return "main";
  return null;
}

// Map TheMealDB `strCategory` to a course (Dessert/Starter/Side are explicit
// categories; meat/pasta/seafood/veg categories are mains; Breakfast isn't a course).
export function courseFromMealDBCategory(category: string | null | undefined): Course | null {
  if (!category) return null;
  const c = category.toLowerCase().trim();
  if (c === "dessert") return "dessert";
  if (c === "starter") return "starter";
  if (c === "side") return "side";
  if (c === "breakfast") return null;
  return "main";
}

// Last-resort heuristic from a recipe title — for AI recipes / backfill where no
// source metadata exists. Returns null (caller defaults to "main") when unsure.
export function courseFromTitle(title: string): Course | null {
  const t = title.toLowerCase();
  if (
    /\b(cake|pudding|tart|pie|ice ?cream|brownie|cookie|cheesecake|malva|koeksister|dessert|trifle|mousse|custard|crumble|doughnut|donut|muffin|cupcake|fudge|baklava)\b/.test(t)
  )
    return "dessert";
  if (/\b(salad|soup|starter|appetiser|appetizer|samoosa|samosa|spring roll|bruschetta|dip|canap)\b/.test(t))
    return "starter";
  return null;
}

// Coerce an arbitrary string (e.g. a form value) to a Course, or null.
export function toCourse(value: string | null | undefined): Course | null {
  if (!value) return null;
  const v = value.toLowerCase().trim();
  return isCourse(v) ? v : null;
}

// ─── Spoonacular diet mapping ─────────────────────────────────────────────────

export function mapSpoonacularDiets(diets: string[]): string[] {
  const map: Record<string, string> = {
    vegetarian: "vegetarian",
    "lacto ovo vegetarian": "vegetarian",
    vegan: "vegan",
    "gluten free": "gluten-free",
    "dairy free": "dairy-free",
    ketogenic: "keto",
    paleo: "paleo",
    paleolithic: "paleo",
    primal: "paleo",
    whole30: "whole30",
    "whole 30": "whole30",
    mediterranean: "mediterranean",
  };
  const result = new Set<string>();
  for (const d of diets) {
    const mapped = map[d.toLowerCase()];
    if (mapped) result.add(mapped);
  }
  return [...result];
}

export function getNutrient(
  nutrients: Array<{ name: string; amount: number }>,
  name: string
): number | null {
  const n = nutrients.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return n != null ? Math.round(n.amount) : null;
}
