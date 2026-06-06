# B8 — Structured daily course slots (scope)

Status: **scoped, not started.** Backlog item B8 in [PHASE-LEDGER.md](./PHASE-LEDGER.md).

Source feedback: *"Need to setup the week in the meal plan and allow for the admin/head of the family to choose starters, mains, dessert per day, and desserts must not come up as a main."*

## Product decisions (locked with owner, 2026-06-06)

1. **Course model:** a **family default** set + **per-day opt-in**. The family default (e.g. `[main]`) seeds every day of a new plan; the admin can then opt an *individual day* into extra courses — add a Starter and/or Dessert to just that day (e.g. a 3-course Sunday). Multi-course is an occasional per-day choice, not all-or-nothing: many families do full courses only on special days (once a month, a birthday), so it must be cheap to turn on for one day and off again.
2. **Voting:** per course — every course gets its own 3-option vote (same love/up/down mechanic as today).
3. **Classification:** auto-derive a recipe's course from source metadata (Spoonacular `dishTypes` / TheMealDB `strCategory`) on save, AI/heuristic backfill for existing recipes, with manual override. A dessert-tagged recipe cannot be assigned to a main slot (and vice-versa); untagged/unknown is allowed anywhere.

## Current model (what we're changing)

- A day = up to 3 `meal_plan_slots` (`option_number` 1–3), effectively one dinner contest. `recipes` has **no** course/meal-type field — only `cuisine` + `diet_types`.
- Members vote per slot (`votes`); `WeeklyCalendar` shows the day's options and a "Leading" badge.
- Gamification (streak, weekly leaderboard, monthly **Dinner Champion**) is computed from **votes cast per member** — it is course-agnostic and keeps working unchanged with more slots.
- `generateShoppingList` takes **one recipe per day** (confirmed, else lowest option with a recipe).
- P17 auto-reshuffle re-rolls a **day's** other options on selection.

## Target model

- `families.courses text[]` — the **default** courses seeded onto each day of a new plan (default `['main']` → behaves exactly as today).
- `recipes.course text` — `'starter' | 'main' | 'dessert' | 'side'`, nullable (unknown).
- `meal_plan_slots.course text NOT NULL default 'main'` — slots keyed by (plan, day, **course**, option_number).
- **Per-day courses are presence-based** — the courses on a given day = the courses that have slots for that day. No extra table: opting a day into Dessert simply creates that day's dessert option slots; opting out deletes them. Family default only seeds generation; the admin tunes each day afterward.
- A day renders one section per course present that day; each course has its 3 voting options. `main` is always present (cannot be removed); `starter`/`dessert` are the opt-in courses.

## Implementation plan (phased — each phase ships green and is backward-compatible)

### B8.1 — Schema + classification (additive, no behaviour change)
- Migration: add `recipes.course` (nullable), `families.courses text[] default '{main}'`, `meal_plan_slots.course text not null default 'main'`; backfill existing slots to `'main'`.
- Capture course on save: map Spoonacular `dishTypes` (`dessert`→dessert, `appetizer`/`starter`→starter, `main course`→main, `side dish`→side) and TheMealDB `strCategory` (`Dessert`→dessert, `Starter`→starter, `Side`→side, else main) in `saveSpoonacularRecipe` / `saveMealDBRecipe`; AI-Chef recipes emit a course.
- One-off backfill for existing recipes: `scripts/backfill-recipe-course.mjs` — heuristic on title/category, unknown→`main` (safe default). Optional AI pass for ambiguous ones.
- Manual override: course selector on the recipe detail/add UI.
- **Default `families.courses = ['main']` keeps the meal-plan UI identical until a family opts in.**

### B8.2 — Family default-course configuration
- Family-settings card (admin-gated, mirrors `CountryForm`): pick the **default** courses seeded onto new plans from `[starter, main, dessert]` (`main` always on). `updateFamilyCourses` action; validate subset + must include `main`. This only sets the generation seed — per-day tuning happens in B8.3.

### B8.3 — Course-aware generation, slots, voting, shopping + per-day opt-in (the large phase)
- `generatePlan`: for each day × each **default** course, create 3 option slots drawn from the **course-filtered** library (reuse the distinct-per-group draw from P16; fallback to unknown-course recipes when a course pool is thin; leave empty + prompt if none).
- **Per-day opt-in (the headline UX):** in `WeeklyCalendar`, each day shows admin-only "➕ Add starter / Add dessert" affordances and a remove control on opt-in course sections.
  - `addCourseToDay(planId, day, course)` — creates that day's 3 course-filtered option slots (idempotent; main can't be added/removed).
  - `removeCourseFromDay(planId, day, course)` — deletes that day's slots for the course; **guard**: if any of those slots have votes, require confirm (client) — server deletes votes via existing FK/cascade or refuses; decide in B8.3.
- `WeeklyCalendar`: group slots day → course → options; render a labelled section per course present that day. Voting unchanged per slot.
- Single-vote rule becomes **one vote per (day, course)** (today it's one per day).
- `generateShoppingList`: pick the winning recipe per (day, course) and aggregate across all courses present.
- P17 reshuffle: scope to (day, **course**) — re-roll other options of the same course; dedupe the chosen recipe within that course across days; course-filtered pool.

### B8.4 — AI suggestions + enforcement + polish
- `suggestForSlot` / `suggestWithAI`: generate a recipe of the slot's course; course-aware exclude list.
- Enforce classification: `assignRecipeToSlot` rejects a recipe whose course conflicts with the slot's course (unknown allowed).
- Empty-course states, copy, and the "Dinner Champion" label (keep, or rename "Meal Champion").

## Risks & mitigations
- **Backward compatibility:** all existing slots backfill to `course='main'` and `families.courses` defaults to `['main']`, so behaviour is identical until a family opts into more courses. ✅
- **Thin course pools:** course-filtering shrinks candidates; small libraries → empty starter/dessert slots. Mitigate with unknown-course fallback, AI-suggest, and an "add recipes" prompt.
- **Vote/shopping semantics:** moving from per-day to per-(day,course) changes shopping aggregation and the single-vote rule — covered in B8.3, needs test updates.
- **Classification accuracy:** auto-derive is imperfect; manual override + safe `main` default contain the blast radius.
- **Removing an opted-in course-day with votes:** deleting a day's dessert slots after the family has voted discards those votes — require a client confirm and decide whether the server cascades or refuses (B8.3). `main` is non-removable, so the core contest is never lost this way.

## Effort (rough)
B8.1 small–medium · B8.2 small · B8.3 large · B8.4 medium. Recommend shipping B8.1+B8.2 first (safe, invisible until opt-in), then B8.3 behind the family's course config.
