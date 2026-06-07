# B15 — AI "plan my whole week" (scope)

Status: **scoped, not started.** New pilot feedback (2026-06-07, `/meal-plan`): *"You should allow the AI assistant to suggest the whole week."*

## Today's behaviour

`suggestWithAI` (the "Suggest with AI" button) already generates **up to `remaining` budget** recipes (max 7) in one call and fills empty option slots in order — so it stops partway through the week once the 7/week budget is used. There's no way to fill the *whole* week in one go.

AI budget is currently counted by **AI recipes added to `family_recipes` this week** (`getAIUsageThisWeek` → counts `family_recipes` rows whose recipe `source='ai'`, since week start). So each AI recipe = 1 use.

## Product decisions (locked with owner, 2026-06-07)

1. **Output:** 3 main options per day for the **whole week** — the full voting contest on every day (up to 7×3 = 21 dishes). (Main course only; starters/desserts stay per-slot / from the library.)
2. **Budget:** the whole-week generation counts as **1 AI use** (one tap leaves 6 per-slot suggestions), regardless of how many dishes it produces.
3. **Existing meals:** **only fill empty slots** — never overwrite a chosen/voted/confirmed slot.

## The core problem: "1 use" vs the per-recipe counter

If the 21 generated recipes were added to `family_recipes` (like per-slot suggestions are), `getAIUsageThisWeek` would count them as 21, not 1. So:

- **Don't add week-plan recipes to `family_recipes`** — save them as global AI recipes and assign them straight to slots (same trick B12.3 uses for event menus so they don't inflate the budget).
- **Count AI usage from an explicit ledger** instead of `family_recipes` rows, so a week-plan can log exactly **one** usage entry while a per-slot suggestion logs one too.

## Implementation plan (phased — each ships green)

### B15.1 — AI-usage ledger (refactor, behaviour-preserving)
- Migration: `ai_usage` table — `id`, `family_id` → families, `kind` (`slot` | `week_plan`), `created_at`; index `(family_id, created_at)`. RLS family-scoped (mirrors meal_plans).
- `getAIUsageThisWeek(familyId)` → counts `ai_usage` rows since `currentWeekStart()` (was: `family_recipes` ai rows).
- `suggestForSlot` and `suggestWithAI` log one `ai_usage` row (`kind='slot'`) per generation. Net behaviour unchanged (still 1 use each, still 7/week).
- Backfill optional (a fresh week resets anyway).

### B15.2 — Plan-my-week action + button
- `planWeekWithAI()` action: budget check (`FREE_AI_LIMIT - getAIUsageThisWeek > 0`) + burst limit; find empty **main** option slots across the 7 days (status `suggested`, no recipe, no votes); generate enough distinct mains (3 per empty day, capped at the empty-slot count) via `suggestMeals` (course-aware, excludes library + already-assigned titles); save each as a **global** AI recipe (`nutrition` already estimated, NOT added to `family_recipes`); assign to the empty slots; log **one** `ai_usage` row (`kind='week_plan'`); creates the plan if none exists.
- Meal-plan page: a "✨ Plan my week with AI" button alongside the existing "Generate plan" (library) + per-slot suggest. Loading state; respects budget (disabled/upsell when 0 left).

## Risks & mitigations
- **Token limits / cost:** 21 full recipes (ingredients + instructions) won't fit one Claude response. Generate in batches internally (e.g. a few calls) — still **one** budget use + one user operation. Note the real API cost per tap; consider capping options-per-day to 2 if needed.
- **"Only fill empty" correctness:** target only `suggested` main slots with `recipe_id IS NULL` and no votes; never touch confirmed/voted slots.
- **Distinctness:** reuse the per-(day) distinct draw so a day's options differ and the week avoids repeats; pass excludes.
- **Budget accuracy:** the ledger makes per-slot and week-plan both count cleanly; keep `family_recipes`-based counting out once migrated.
- **Premium hook (future):** "1 use" keeps it free-tier-friendly now; a later premium tier could make it unlimited (ties into `[[project_commercialisation]]`).

## Effort (rough)
B15.1 medium (ledger refactor across 2 actions + migration) · B15.2 medium (generation + placement + UI). Ship the ledger first (behaviour-preserving), then the week planner on top.
