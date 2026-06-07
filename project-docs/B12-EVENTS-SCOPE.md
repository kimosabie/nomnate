# B12 — Braai / party event planner (scope)

Status: **scoped, not started.** Backlog item B12 in [PHASE-LEDGER.md](./PHASE-LEDGER.md).

Source feedback: *"South Africans like to entertain — a section for prepping for a party or a braai, with ideas for salads, hot dishes like potato bake, and desserts."*

## Product decisions (locked with owner, 2026-06-07)

1. **Event planner** — create an event (name, date, guest count) and build a themed menu across categories (salads/sides, mains, desserts); saved + reusable; generates a shopping list.
2. **AI generator + library** — "Braai for 12" → AI proposes a full themed menu you can tweak; also add dishes from your recipe library; remove/swap any dish.
3. **Shopping list scaled to guest count** — consolidated ingredients scaled from each recipe's servings up to the guest count.

## How it reuses what exists

- **Recipes + `course`** (B8) — event dishes are real recipes tagged starter/main/dessert/side; "salads & sides" map to `side`/`starter`, hot dishes to `main`, puddings to `dessert`.
- **AI chef** — already generates structured recipes (with ingredients) via tool use; the menu generator reuses that so each dish has ingredients for the shopping list.
- **Ingredient consolidation** — `consolidateIngredients` exists in meal-plan/actions.ts but is coupled to `meal_plan_slots`; extract to a shared util for event shopping.

## Data model

**`events`** (family-scoped):
| column | notes |
|---|---|
| `id` uuid pk | |
| `family_id` uuid → families(id) ON DELETE CASCADE | |
| `name` text NOT NULL | content-filtered |
| `event_type` text | braai \| party \| dinner \| other |
| `event_date` date NULL | |
| `guest_count` integer NOT NULL default 4 (check > 0) | drives shopping scaling |
| `created_by` uuid, `created_at` timestamptz | |

**`event_dishes`** (the menu):
| column | notes |
|---|---|
| `id` uuid pk | |
| `event_id` uuid → events(id) ON DELETE CASCADE | |
| `recipe_id` uuid NULL → recipes(id) ON DELETE SET NULL | the dish (real recipe → has ingredients) |
| `course` text | starter \| main \| dessert \| side (menu grouping) |
| `label` text NOT NULL | recipe-title snapshot (survives recipe deletion) |
| `created_at` timestamptz | |

- **RLS — family-scoped** (mirrors `meal_plans`/`meal_plan_slots`): a family member can CRUD events + dishes for their family.
- Dishes reference real recipes so the shopping list has ingredients; AI-generated menu dishes are saved as recipes (global + added to the family library, like AI chef) then linked.

## Implementation plan (phased — each ships green)

### B12.1 — Data model + backend
- Migration: `events` + `event_dishes` + indexes + RLS.
- Hand-update `packages/supabase/src/types.ts`.
- Actions: `createEvent` / `updateEvent` (name/date/guests/type) / `deleteEvent`; `addDishFromRecipe(eventId, recipeId, course)` / `removeDish(dishId)`; `getEvent(id)` / `listEvents()`. Family resolved server-side; `name` content-filtered.

### B12.2 — Events UI
- `/events` list (upcoming/past, create button) + `/events/[id]` detail: header (name, date, guest count — editable), menu grouped by course, **add from library** (searchable picker → pick course), remove/swap dishes. Nav entry. Create-event flow.

### B12.3 — AI themed menu generator
- `generateEventMenu(eventId)`: builds a themed menu for the event type + guest count via Claude (reuse the AI-chef structured-recipe path), saving each dish as a recipe (global + family library) and linking as `event_dishes` across courses. Rate-limited / cost-gated (counts against AI usage). "Generate menu" button on the event page; results are editable (remove/swap).

### B12.4 — Guest-scaled shopping list
- Extract `consolidateIngredients` to a shared util. For each event dish: scale factor = `guest_count / (recipe.servings || 4)`, multiply ingredient quantities, consolidate across the whole menu. Render on the event page with copy / WhatsApp share (mirrors the shopping-list UX). Check-off persistence deferred to a later pass.

## Risks & mitigations
- **AI cost/latency** — a full menu is several recipes; generate in one structured call where possible, rate-limit, and gate against the AI usage budget. Show a clear loading state.
- **Scaling math** — `recipe.servings` may be null → default 4; round sensibly; consolidation must keep unit handling from the existing logic.
- **Nutrition/ingredients** — AI dishes go through the B7.1 estimate path so they're complete; library dishes already have ingredients.
- **Scope creep** — v1 shopping list is display + share (no per-item check-off); assignments/"who brings what" explicitly out (was option C, not chosen).
- **Privacy** — only menu/recipe context to Claude, no PII.

## Effort (rough)
B12.1 medium · B12.2 large (UI) · B12.3 medium (AI) · B12.4 medium. The largest remaining backlog item. Ship backend → UI (manual menu) → AI generator → scaled shopping.
