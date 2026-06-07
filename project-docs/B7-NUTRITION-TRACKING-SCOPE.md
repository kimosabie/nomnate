# B7 — Nutrition tracking (food diary) scope

Status: **scoped, not started.** Backlog item B7 in [PHASE-LEDGER.md](./PHASE-LEDGER.md).

Source feedback: *"Calorie tracking is not really effective as the meals or recipes don't have the details."*

## The real gap (from investigation)

- Recipes already store `calories_per_serving` + `protein_g/carbs_g/fat_g`, and ~82% are populated (Spoonacular 90/93, AI 63/66, **TheMealDB 0/4**, manual none). So data is *mostly* there but incomplete.
- The bigger issue: **there is no tracking surface at all.** `family_members.daily_calorie_target` and `track_calories` are set on the profile and recipes show per-serving calories, but **nothing ever totals a day against a target.** "Calorie tracking" today = set a number that's never used.

## Product decisions (locked with owner, 2026-06-07)

1. **Active food diary** — members log what they actually ate each day; the app totals it against their target. A real tracker (new table + logging UI), not just a passive plan rollup.
2. **Per-member targets** — totals compare against each member's existing `daily_calorie_target` (gated by `track_calories`).
3. **Hybrid nutrition fill** — estimate missing nutrition via Spoonacular's nutrition endpoint from the recipe, AI-estimate (Claude) as fallback; flag estimates as approximate.

## Data model

**New `food_log_entries`:**
| column | notes |
|---|---|
| `id` uuid pk | |
| `family_member_id` uuid → family_members(id) ON DELETE CASCADE | who logged it |
| `logged_date` date NOT NULL | the diary day |
| `meal_type` text NULL | breakfast \| lunch \| dinner \| snack (grouping) |
| `recipe_id` uuid NULL → recipes(id) ON DELETE SET NULL | when logged from a recipe |
| `label` text NOT NULL | recipe-title snapshot or custom name (content-filtered) |
| `servings` numeric NOT NULL default 1 | |
| `calories`,`protein_g`,`carbs_g`,`fat_g` integer NULL | **snapshotted at log time** (× servings) so later recipe edits/deletes don't rewrite history |
| `nutrition_estimated` boolean default false | source nutrition was AI/Spoonacular-estimated |
| `created_at` timestamptz default now() | |

- Index `(family_member_id, logged_date)`.
- **RLS — owner-only:** a member may CRUD rows whose `family_member_id` belongs to a `family_members` row with `user_id = auth.uid()`. (Family-wide visibility deliberately out — a food diary is personal.)
- Optional: `recipes.nutrition_estimated boolean` to flag recipe-level estimates.

## Implementation plan (phased — each ships green)

### B7.1 — Nutrition completeness (foundation, no UI)
- `packages/lib/src/spoonacular.ts`: add `guessNutrition(title)` (GET `/recipes/guessNutrition`) → `{calories,protein,fat,carbs}`.
- Server util `estimateNutrition(recipe)`: Spoonacular `guessNutrition` first; Claude estimate fallback; returns calories + macros + `estimated=true`.
- On save: TheMealDB save (sets none today) and manual/AI-without fill missing nutrition; mark `nutrition_estimated`.
- `scripts/backfill-recipe-nutrition.mjs`: fill recipes with null calories (Spoonacular → AI fallback), rate-limited, `--dry` supported.

### B7.2 — Food-log backend
- Migration: `food_log_entries` + indexes + RLS (owner-only).
- Hand-update `packages/supabase/src/types.ts` for the new table.
- Actions: `addLogEntryFromRecipe(recipeId,{date,mealType,servings})` (snapshots recipe nutrition × servings), `addCustomLogEntry({date,label,mealType,calories,macros})`, `deleteLogEntry(id)`, `getDayLog(date)` (entries + the member's `daily_calorie_target`). Member resolved server-side; `label` content-filtered.

### B7.3 — Food diary UI (the large phase)
- New `/food-log` route: date nav (prev / today / next); entries grouped by meal type; per-entry kcal + macros; running daily total with a progress bar vs the member's `daily_calorie_target`; add-custom-entry form; add-from-library (reuse the recipe search/picker). Sidebar nav entry. Respect `track_calories` (prompt to set a target if unset).

### B7.4 — Quick-log from the meal plan
- "Log this" affordance on a meal-plan slot's recipe → `addLogEntryFromRecipe` for today (meal_type derived from course where sensible). Closes the loop between planning and tracking.

## Risks & mitigations
- **Estimates are approximate** — always flag `nutrition_estimated` in the UI ("~"); never present AI/Spoonacular numbers as exact.
- **History integrity** — nutrition is snapshotted onto the log entry at log time, so editing/deleting a recipe never corrupts past days.
- **Cost/latency** — backfill is one-off + rate-limited; on-save adds one estimate call only for recipes lacking nutrition (mostly MealDB); AI fallback gated.
- **Privacy** — only recipe title/ingredients go to Claude/Spoonacular (no PII); diary entries are owner-only via RLS.
- **Per-serving semantics** — logged calories = `calories_per_serving × servings`.

## Effort (rough)
B7.1 medium · B7.2 medium · B7.3 large · B7.4 small. Ship B7.1 first (fills data, no UI), then the backend + diary, then plan quick-log.
