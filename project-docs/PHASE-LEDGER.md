# Phase Ledger

**Canonical phase → commit record for NomNate, plus the live work-stream backlog.**

This ledger is the authoritative mapping of project phases to the commits that
shipped them, and the canonical status of the open work streams. **Where this
ledger and any conversational recap (or the `todo_items` table) disagree, the
ledger wins** — that is the entire point of recording it.

## How NomNate differs from the Compass ledger

The Compass project (`vast-aiops-sizingtool`) labels every commit with its phase
(`feat(K.17): …`), so its ledger is bootstrapped mechanically from `git log`.
**NomNate uses plain conventional commits with no phase labels.** Phases here are
therefore a *retroactive thematic grouping* of the history:

- **Phase** — a sequential label (`P0`, `P1`, …) assigned in this ledger, not in
  git.
- **Title** — the subject line of the phase's most representative commit, verbatim.
- **Scope** — a one-line human summary of what the phase delivered.
- **Representative commit** — the most substantive commit for the theme (not
  necessarily the chronologically last). Fix/chore commits in the same theme are
  folded in, not given their own row. Time ranges of adjacent phases may overlap.
- **Date** — author date of the representative commit (`YYYY-MM-DD`).

## Shipped phases

| Phase | Title (commit subject) | Scope | Commit | Date |
|-------|------------------------|-------|--------|------|
| P0 | feat: rewrite schema and add all missing packages | Turborepo scaffold (Next.js 16 web + Expo mobile + shared packages), Supabase schema and RLS. | `248b4bf` | 2026-05-07 |
| P1 | feat: family create/join flow | Auth (web + mobile), email/OAuth, family create/join via invite code; RLS recursion + onboarding-policy fixes folded in. | `44c1242` | 2026-05-07 |
| P2 | feat: diet types, calorie tracking, custom recipe entry, nutrition display | Recipe detail, shopping-list generation, AI meal suggestions (Claude), interactive per-slot meal plan, per-member preferences, diet/nutrition. | `f9808e0` | 2026-05-09 |
| P3 | feat: complete NomNate branding — flame/cream tokens across all pages | Design system: Fredoka font, flame/herb/cream tokens, rounded-full buttons, full-app branding. | `5a7344c` | 2026-05-09 |
| P4 | feat: shopping list — store picker replaces cycle badge | Shopping-list hardening: full server render (no client JS), per-store pages, store picker, persisted checkbox state — fixes the SSR hydration class of bugs. | `e5bf0a0` | 2026-05-10 |
| P5 | feat: first-to-vote animation and monthly Dinner Champion | Gamification dashboard: real streaks, top voter, weekly leaderboard, first-to-vote, monthly Dinner Champion. | `b4673f2` | 2026-05-10 |
| P6 | feat: add legal footer to app layout for POPIA compliance | Legal pages (Privacy/ToS/Cookies), email verification, delete-account (POPIA), rate limiting, content filtering, admin feedback page. | `e4a52b0` | 2026-05-10 |
| P7 | feat: mobile tab navigation, meal plan voting, and shopping list screens | Three-tab Expo app (Meals/Shopping/Profile) — built, not yet device-tested. | `663d3a8` | 2026-05-10 |
| P8 | feat: daily feedback review — AI todo system + admin approval UI | PWA support, Resend feedback-notification email, and the daily AI feedback-triage cron → `todo_items` + admin approval UI. | `ae7f121` | 2026-05-11 |
| P9 | feat: unified recipe search, AI Chef agent, SA seed script, Unsplash attribution | Recipe sources (TheMealDB + global DB-cached library), AI Chef, unified search, international stores; voting-rule round (single vote/day, exclude assigned meals, metric units, recipe summary) folded in (`dbdce3a`). | `193fe96` | 2026-05-11 |
| P10 | feat: todo history + exclude assigned meals from AI suggestions | Family store preferences (`preferred_stores`), admin route-group split, daily-brief/todo workflow, per-item feedback delete. | `4143ab9` | 2026-05-12 |
| P11 | fix: add AU/AE/GB locales to shopping list print view LOCALE_MAP | Localisation for the expat pilot (ZA/GB/FR/AU/AE): `@nomnate/shared` prompts, per-country stores, locale-aware dates; gamification dashboard polish folded in (`a5a8c1f`). | `6612ab6` | 2026-05-14 |
| P12 | chore: fix typecheck and lint gates across the monorepo (#1) | Repaired the standalone `pnpm typecheck` (3 pkgs) and `pnpm lint` (mobile/web) gates; all three gates green on `main`. | `ffe46ad` | 2026-06-06 |
| P13 | fix: country dropdown on family registration (ZA/GB/FR/AU/AE) | Onboarding offered only 3 countries (`ZA`/`UK`/`FR`) and the wrong `UK` code; widened to the canonical 5 and removed dead `UK` branches. | `6d50349` (#2) | 2026-06-06 |
| P14 | fix: meal-plan swap picker shows the whole library (manual + saved global) | The swap/add picker queried only `recipes.family_id`, missing saved global-library recipes (which live in the `family_recipes` junction) — so a family with a 26-recipe library saw 0 options. Picker + empty-state count now combine both sources. | `ab08914` (#3) | 2026-06-06 |
| P15 | feat: clickable recipe search results + family rename + AI-Chef AU/AE | Library search results link to the `/recipes/[id]` detail page (B6); family admins can rename the family inline (B11); AI Chef store guidance completed for AU/AE incl. halal for AE (B14). | `ab08914` (#3) | 2026-06-06 |
| P16 | fix: filter test feedback from triage + distinct daily meal options | Obvious test submissions ("test", "tes3", …) are quarantined (marked reviewed) so they never reach AI triage or the review queue (B13); `generatePlan` now guarantees each day's 3 options are distinct (B9, partial). | `ab08914` (#3) | 2026-06-06 |
| P17 | feat: auto-reshuffle meal options from the library on selection | Assigning a recipe to a slot now re-rolls that day's other suggested/unvoted options from the family library and drops the chosen recipe from other days' options (no AI, votes preserved); changed slots returned so the client updates live (B9 complete). | `ab08914` (#3) | 2026-06-06 |

## Planned work streams (feedback backlog)

Derived from the `feedback` table → AI triage → `todo_items`. **Status is judged
against git history, not the `todo_items.archived_at` column** — the table has
drifted (nothing is archived), so several items it shows as "open" are in fact
shipped. The ledger is the source of truth; archiving the table to match is a
pending reconciliation.

| ID | Work stream | Priority | Status (ledger truth) | Evidence |
|----|-------------|----------|-----------------------|----------|
| B1 | Fix country dropdown on family registration | 🔴 critical | Shipped | P13 — merged in PR #2 |
| B2 | Fix meal-swap option picker not loading | 🔴 critical | Shipped | P14 — picker now combines manual + saved global recipes |
| B3 | Enforce single vote per user per day | 🟠 high | Shipped — archive pending | P9 (`dbdce3a`) |
| B4 | Exclude selected meals from other days' suggestions | 🟠 high | Shipped — archive pending | P9 (`dbdce3a`) |
| B5 | Localise recipe measurements to SA units | 🟠 high | Shipped — archive pending | P9 (`dbdce3a`) + P11 |
| B6 | Recipe detail: dish summary + cooking method | 🟠 high | Shipped — library search results now link to detail (P15); external (unsaved) results still save-first | P2 `3cd952c`, P9 `dbdce3a`, P15 |
| B7 | Nutritional data so calorie tracking works | 🟠 high | **Partial** — UI shipped P2 (`f9808e0`); data quality open | partial |
| B8 | Structured daily course slots (starter/main/dessert) | 🟠 high | **Open** | not in git |
| B9 | Auto-refresh daily options after a selection | 🟡 medium | Shipped | P16 (distinct daily options) + P17 (library auto-reshuffle on selection — chosen over AI re-roll to avoid the 5/week cap; votes preserved) |
| B10 | Preferred grocery-store selection UI (≤5) in Family Settings | 🟡 medium | Shipped | `StorePreferencesForm` on `/family` — admin-gated, country-filtered, keeps ≥1; all countries already ≤5 stores |
| B11 | Family-name editing for family admins | 🟡 medium | Shipped | P15 — inline rename on `/family` for admins |
| B12 | Party/braai event-planning section | 🟡 medium | **Open** | not in git |
| B13 | Filter/flag test feedback submissions | 🟢 low | Shipped | P16 — triage auto-quarantines test submissions (bulk delete already existed, P10 `10889eb`) |
| B14 | AI Chef localisation for AU/AE (un-localised stores/guidance) | 🟡 medium | Shipped | P15 — AU/AE store names + guidance added (halal for AE) |

## Regeneration

To regenerate the source listing for spot-checks (run from the repo root):

```bash
git log main --no-merges --reverse --pretty=format:'%h|%ad|%s' --date=short
```

When a new phase ships, append its row with the representative commit and a
one-line Scope. When a backlog item ships, change its Status to "Shipped" and cite
the phase/commit. Because NomNate commits are unlabelled, keep the phase numbering
here — it does not come from git.
