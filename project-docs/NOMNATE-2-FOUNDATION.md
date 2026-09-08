# NomNate 2.0 — Phase 1 Foundation

## 1. Purpose and recovery

Phase 1 establishes an authenticated, family-isolated Dinner Draft domain and an authoritative decision boundary while preserving the existing calendar and shopping flows. It does not introduce a new Dinner Draft experience.

The interrupted implementation was recovered on `feature/nomnate-2-foundation`, based on `9022386`. Before further edits, the recovered working tree was archived to `/home/kimo/project-backups/nomnate/20260908T075634.062665Z`. The backup includes branch/status, binary unstaged and staged diffs, a separate archive of all 13 then-untracked files, and a full working-tree archive excluding `.git` and `node_modules`. No recovered work was reset or discarded. No migrations were applied during this recovery; the previous session's remote migration state is unknown.

## 2. Architecture decisions

- `packages/shared/src/dinnerDraft.ts` holds pure scoring, finalisation authorization, winner-intent orchestration, and commitment checks. It has no database or framework dependency.
- `dinner-draft/actions.ts` is the authenticated web adapter. It reads the domain inputs and calls the transactional database RPC. Client calculations never persist a winner directly.
- Meal-plan actions are split into `plan-actions.ts`, `slot-actions.ts`, `vote-actions.ts`, `ai-actions.ts`, and `shopping-actions.ts`, with `helpers.ts` and `guards.ts` for shared implementation.
- The original `meal-plan/actions.ts` remains an import-compatible barrel. Only the implementation modules declare `"use server"`; Next.js rejects re-exports in a barrel with that directive.
- One draft represents **one date/course decision**, even when its `draft_type` is `weekly`. A future weekly orchestration can compose multiple drafts. Phase 1 refuses a mixed-date/course contest at finalisation.
- There is no family switcher. The active family is the caller's earliest membership ordered by `joined_at`, then membership `id`. Web/mobile first-membership reads use the same order as `active_family_id()`. Joining another family does not automatically switch the active family. Historical multiple memberships are preserved.
- Finalisation and cancellation are limited to the draft creator or an admin of the active family. Normal family members can react using their own membership.

## 3. Dinner Draft schema

| Table | Fields and constraints |
| --- | --- |
| `dinner_drafts` | UUID `id`; `family_id` FK with family cascade; authenticated `created_by` FK; `status` (`open`, `finalised`, `cancelled`); `draft_type` (`tonight`, `weekly`); nullable Monday `week_start`; nullable `expires_at`; `created_at`, `updated_at`; nullable `winner_candidate_id`, `finalised_at`, and JSON `result`. A check requires all result fields only for a finalised draft. |
| `draft_candidates` | UUID `id`; cascading `draft_id` FK; `recipe_id` FK; nullable `target_date` and `course` (`starter`, `main`, `dessert`, `side`); `nomination_source` (`planner`, `library`, `ai`); nonnegative `display_order`; `created_at`. Unique recipe and display position per draft. |
| `draft_votes` | UUID `id`; cascading `candidate_id` and `family_member_id` FKs; checked `reaction`; `created_at`, `updated_at`. Unique `(candidate_id, family_member_id)`. |

A composite FK ensures the persisted winning candidate belongs to that draft. Indexes cover family/status lookup, recipe references, member votes, and candidate uniqueness. All three tables enable RLS.

`meal_plan_slots.committed_draft_id` references the draft. Partial unique indexes permit at most one committed slot per plan/day/course and at most one slot per draft. Types and RPC signatures are represented in `packages/supabase/src/types.ts`; new relationship metadata is currently manually maintained rather than regenerated from a deployed database.

## 4. Lifecycle

An authenticated caller creates an `open` draft in their active family. Its creator/admin can nominate candidates. Family members can add, update, or delete their own reactions while it is open and unexpired. Candidate identity is immutable; recipe/date/course cannot change after reactions exist for that candidate.

`open -> finalised` happens only through `finalise_dinner_draft`. `open -> cancelled` happens only through `cancel_dinner_draft`. There is no reopening, revoting after closure, or committed-meal replacement service in Phase 1. Candidate deletion while open remains possible for the planner/admin.

Expiration closes reactions; it does not automatically change status and does not prevent a planner/admin from finalising the recorded result afterward. `updated_at` on votes changes on reaction writes; draft `updated_at` changes on state transitions, not every candidate/reaction write.

## 5. Reaction scoring

| Reaction | Score |
| --- | ---: |
| `love` | +3 |
| `eat` | +1 |
| `whatever` | 0 |
| `nope` | -3 |

The pure scorer returns every candidate's score, vote count, reaction breakdown, total vote count, winner or `null`, explicit `tied`, and `tiedCandidateIds`. Candidates without reactions have score zero. Consequently an unreacted candidate may beat a negatively rated candidate when votes exist elsewhere; no implicit veto or participation threshold is introduced.

One member can react to multiple candidates but only once per candidate. Updating a reaction replaces that database row; feeding duplicate member/candidate rows into the pure scorer is rejected instead of counted twice. The existing calendar's `up/down/love` voting remains a separate legacy domain with one vote per member/day/course.

## 6. Ties

Equal top scores produce an explicit tie, regardless of candidate input order. Sorting IDs only stabilizes presentation. Finalisation rejects ties, empty contests, and contests with no votes. No arrival order, nomination order, random choice, or implicit planner preference breaks a tie. Resolve an open contest through changed participation/candidates or cancel it; a tie-resolution UX is future work.

## 7. Finalisation flow

1. Authenticate the caller and resolve their active family and membership.
2. Verify the draft belongs to that family, is open, and the caller is its creator/admin.
3. Read candidates/reactions; compute the pure result and require one winner.
4. Send only `{ draft_id, expected_winner }` as intent to the RPC.
5. The RPC repeats authorization, locks the draft row, and independently scores current database rows using the same weights.
6. Reject no candidates, no votes, ties, a stale expected winner, an inaccessible winning recipe, or mixed target dates/courses.
7. If applicable, commit the meal as described below; persist `winner_candidate_id`, result JSON, `finalised_at`, `updated_at`, and `status = 'finalised'` in the same transaction.
8. Revalidate meal-plan and shopping pages. The saved result includes `committedSlotId` when a meal was committed.

Candidate/reaction triggers lock the same draft row and recheck authorization after locking. Different drafts committing meals are serialized by a family lock followed by a plan lock. Database failures roll back the RPC. The TypeScript preflight is a user-facing check, not the security boundary.

## 8. Meal-plan commitment

A non-null winning `target_date` determines the Monday week and zero-based day. Null course means `main`. If `week_start` was supplied, it must match this derived week. A null target date finalises the decision without placing a meal in a calendar; the slot ID remains null.

The RPC creates the family/week meal plan if absent. If option 1 for that date/course is absent, it creates it. Otherwise it replaces only option 1 and deletes that slot's legacy recipe-specific votes atomically. It preserves other suggested options. The committed row contains the winning recipe, `status = 'confirmed'`, and `committed_draft_id`. Any existing confirmed/committed meal for that date/course causes finalisation to fail, leaving the draft open.

Regular callers cannot forge, overwrite, clear, relocate, or delete a committed row. Legacy `confirmed` rows receive the same protection. Reset refuses a plan containing one; course removal refuses a protected course. Slot edits, wildcard, and AI check protection before work; guarded writes require a returned row and report a concurrent commitment or RLS-filtered write instead of claiming success. Database triggers repeat protection at the write boundary. Wildcard errors are displayed in the existing dashboard control.

Plan reset and multi-step recipe/AI/reshuffle operations are not fully transactional. They now report write failures, including partial completion, rather than silently reporting success. A reset's slot-delete statement rolls back as a whole if it encounters a concurrent commitment. Course deletion relies on the existing cascading votes FK, so votes are not cleared in a separate earlier operation.

## 9. Shopping integration

`mealShopping.ts` selects one recipe per day/course: committed draft decision first, legacy confirmed choice second, and lowest option only for a plan without an authoritative choice. Conflicting commitments/confirmed choices fail explicitly.

Recipe IDs are deduplicated only for fetching records. Quantity expansion iterates every selected occurrence, so the same recipe on two days contributes twice. Each occurrence scales by people / recipe servings, using the existing event fallback of four servings when metadata is absent or nonpositive. Null quantities remain null; known quantities are rounded to two decimals before consolidation. Events share this scaling helper. Newly generated planner recipes store the requested family serving count to avoid rescaling family-sized quantities as four-person recipes.

`replace_shopping_list` validates active-family ownership and the JSON input, serializes list replacements with a transaction advisory lock, and replaces the list/items atomically under invoker RLS. Generating a list still resets its checked/store state, matching prior replacement behaviour. Finalisation invalidates the page but does not automatically regenerate an already-persisted list. Ingredient calculation happens before the replacement transaction; simultaneous plan changes require regeneration.

## 10. Security and tenancy

Direct membership inserts are removed. Family creation uses a validated creator trigger; joining requires a real invite code through `join_family`, which always inserts `member`, never a caller-provided role. Null/empty invite and display-name inputs fail. Existing membership conflicts are idempotent.

Membership user/family/ID/join-time fields are immutable. Only admins can change roles. Meal-plan and shopping mutations are restricted to the active family. Legacy votes must belong to the caller's membership and the slot's family; vote identity cannot be reassigned. The read policy also verifies the member/slot family match, hiding any historical cross-family votes without deleting them. Draft votes require the caller's own membership in the draft family and an open, unexpired draft. Anonymous callers receive no draft/voting RPC grants.

The recovered tenancy migration explicitly replaces prior policies on the six affected membership/planning/shopping tables because permissive policies combine with OR. Production-specific policies must be inventoried before applying this change. RLS and triggers enforce boundaries for direct Supabase clients as well as server actions. Application authorization checks do not replace them.

## 11. SECURITY DEFINER decisions

| Function group | Decision and reason |
| --- | --- |
| `active_family_id`, membership/admin helpers, active-plan/list and vote/draft predicates | Retain definer security for bounded identity/ownership lookups without recursive RLS. Authorization derives from `auth.uid()`; callers cannot supply an alternative user identity. |
| `join_family`, `handle_new_family`, legacy invite lookup | Retain definer security to look up an invite and create the otherwise-disallowed membership. Enforce authenticated caller/creator and fixed member role internally. |
| `finalise_dinner_draft`, `cancel_dinner_draft` | Retain definer security because clients have no draft UPDATE policy and cannot write authoritative commitment/result fields. Explicit active-family and creator/admin checks precede the transition. |
| `guard_draft_candidate`, `guard_draft_vote` | Retain definer security to lock draft rows despite no client draft UPDATE policy. Recheck edit/reaction authorization after locking; narrow FK-cascade exceptions require the parent/member to have disappeared. |
| `guard_meal_vote` | Retain definer security to inspect all competing legacy votes and serialize on the member row. Internally verifies caller identity and active-family slot ownership. |
| `guard_member_identity`, `guard_committed_meal`, `replace_shopping_list` | Invoker security suffices. The commitment guard must see the invoking SQL role to distinguish authenticated client writes from the owner-executed finalisation RPC. List replacement must retain RLS. |

All Foundation function definitions use an explicit search path. The hardening migration replaces the recovered legacy lookup/creator functions with empty-path, schema-qualified definitions, leaving the final function set at `search_path = ''`. Trigger functions are not executable as public/authenticated RPC entry points; RPC grants are explicitly authenticated-only. Owner/service-level database access remains trusted and is not an end-user security boundary. Verify owners and role grants on the target database.

## 12. AI contract

The country-aware system prompt and planner user prompt agree on `title`, `cuisine`, `prep_time`, full `instructions`, and an `ingredients` array of `{ name, quantity, unit }`. Optional calories/macros are nonnegative estimates. Planner quantities explicitly serve the requested family size; all three planner save paths persist that count.

The runtime parser accepts JSON arrays and optional markdown JSON fences, then validates nonempty required strings, finite nonnegative numbers, ingredient shape, size/count limits, and duplicate recipe titles before saving. It rejects the old `name/mainIngredients/estimatedTimeMinutes` shape. Event menus reuse recipe validation and retain their course/serving adaptation.

`suggestForSlot` must successfully authenticate, load membership, verify the slot/plan family, and reject commitments before quota mutation, Claude, image search, or recipe writes. Slot lookup/membership errors abort. All three planner flows also abort on failed or empty family-context reads, so Claude is never called with silently omitted allergy/dietary restrictions or a guessed serving count. AI ingredient/library/slot/ledger mutation errors are surfaced, and zero-row assignments never count as successful writes. External generation plus recipe persistence is not a distributed transaction; a commitment race can leave a saved recipe while correctly refusing the slot write.

## 13. Tests and validation

`pnpm test` uses Node's built-in test runner and the already-installed TypeScript compiler, with no added dependency or lockfile change. `tests/load-typescript.cjs` compiles actual source in memory and mocks external boundaries. Test execution needs no credentials, AI calls, or database. Type correctness is checked separately with the workspace compiler.

Coverage includes all four weights; winner, tie, empty/no-vote behaviour; total/per-candidate counts; duplicate vote rejection; creator/admin authorization; non-member, wrong-user, wrong-family and closed-draft rejection; exact persisted winner intent; transaction error propagation; committed/confirmed guards; repeated shopping quantities and serving scaling; authoritative shopping selection; valid/malformed planner contracts; slot AI authorization before external effects; membership/slot database errors; commitment races; successful AI serving metadata; reset and wildcard protection; and the real finalisation action calling a mocked RPC.

Validation commands: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm --filter @nomnate/web build`, and `git diff --check`. No separate formatter is configured. The recovered server-action barrel initially failed the web build and was corrected; this was a Foundation regression, not a pre-existing unrelated error. Final validation results are recorded in the review handoff.

These tests verify domain/service behaviour and mocked application boundaries, not execution of PostgreSQL policies, trigger locking, or SQL/TypeScript scorer parity. Those remain isolated-database acceptance checks before production.

## 14. Known limitations

- No planner-facing draft creation, reaction UI, results UI, guest links, or accountless participation. Authenticated schema operations and the finalisation adapter form the foundation.
- One date/course per draft; mixed contests fail at finalisation rather than candidate insertion. Null-date drafts do not commit a meal.
- No reopening, committed-meal replacement, automatic expiry job, quorum, veto, or automatic tie breaker.
- First-membership selection persists until a family-switching model exists. Joining a second family does not activate it.
- Existing recipes without reliable servings use the four-serving fallback. Existing generated recipes are not backfilled because their original serving intent is unknown.
- Multi-step AI/reset/reshuffle flows may partially complete on unrelated failures. AI usage reservation is not atomic with paid requests; concurrent quota enforcement remains a separate improvement.
- Results preserve a score snapshot and winner ID, not immutable recipe contents. Global recipe ownership/editing is an existing separate concern.
- Draft `created_by` references an auth user without delete cascade; draft creator account deletion/retention requires an explicit policy before enabling broad adoption. Privileged data cleanup must account for closed-draft references and committed slots.
- The database has not been migrated or integration-tested as part of this task. No claim is made about the deployed schema or the previous session's migration application state.

## 15. Production migration considerations

New migrations, in order:

1. `20260907000001_foundation_tenancy.sql`: additive missing-column reconciliation, deterministic family helpers, membership/role boundaries, planning/shopping/vote RLS and legacy vote guard.
2. `20260907000002_dinner_drafts.sql`: draft schema, RLS, locks, finalisation/cancellation, and committed-slot references/indexes.
3. `20260907000003_atomic_shopping.sql`: transactional shopping replacement RPC.
4. `20260908000001_foundation_guard_hardening.sql`: explicit privileged trigger authorization, confirmed-meal protection, safe legacy-function definitions, trigger execute revocations, nullable join-input validation, and legacy vote-read family checks.

Historical migration SQL is unchanged. The recovered draft migration's misleading security comment was corrected; operational hardening is a new follow-up migration so it also covers a database where the recovered migrations may already have run.

Reconciliation adds `preferred_stores`, member allergy/diet/nutrition fields, recipe description/cook-time/serving/nutrition fields, and shopping store metadata using `ADD COLUMN IF NOT EXISTS`. The country default becomes `ZA` for future omitted values; existing country data is not rewritten. Existing columns with the same name but incompatible types/defaults/nullability are deliberately not coerced. Creation of new draft tables/indexes is versioned and fails on incompatible pre-existing objects rather than hiding drift with broad IF NOT EXISTS clauses. The fourth migration's function replacements/revocations are repeatable.

Before any production application:

- Read the target migration ledger and schema; determine whether any recovered migration has already run. Do not blindly rerun or mark versions applied.
- Inventory affected columns, types, constraints, RLS policies, trigger definitions, function owners, grants, and `search_path`. Reconcile deployment-specific policy differences explicitly. Check historical recipe/member columns against the real schema; `IF NOT EXISTS` does not verify compatibility.
- Audit multiple memberships, admin availability, legacy cross-family votes, and multiple legacy votes per member/day/course. New guards do not delete or repair historical invalid data. Existing votes need deliberate review, not automatic cleanup.
- Confirm vote/list-item cascade FKs, course/option uniqueness, family/week uniqueness, and trusted function ownership. Check any existing `confirmed` rows; they become protected and cannot be edited/reset by clients.
- Test all four migrations on an isolated database representative of deployment. Exercise direct authenticated and anonymous SQL/API access: arbitrary family joins, self-promotion, cross-family votes, forged commitments, creator/admin finalisation, stale winners, ties, missing target slots/plans, rollback and concurrent finalisation/reaction writes. Compare SQL and pure scoring results.
- Verify onboarding and mobile compatibility. Older clients that directly insert memberships must be updated to use `join_family`. Service/admin tooling that creates families without an authenticated creator context must be adapted deliberately.
- Plan an appropriate lock window and database backup. ALTER TABLE, trigger/policy changes, and non-concurrent unique-index creation can lock tables. Migrations use transactions; do not use partial manual application as a rollout strategy.
- Deploy compatible database changes before app code depending on the new columns/RPCs. Verify all four changes as one rollout before exposing draft operations. No deployment or production migration is authorized by completion of this local task.

## 16. Remaining Phase 2 scope

- Planner-facing Dinner Draft creation UX.
- Player swipe/reaction UX.
- Results/celebration screen.
- WhatsApp invitation links.
- Accountless/guest participation, with a separately designed authorization model.
- Weekly composition, explicit tie-resolution and committed-meal replacement UX as needed.
- Gamification later: badges, food personalities, veto mechanics, and additional celebration features.

Existing dashboard presentation was retained; only its wildcard failure handling changed.

## Files changed

Core additions: `packages/shared/src/dinnerDraft.ts`, `packages/shared/src/recipeValidation.ts`, `apps/web/src/lib/mealShopping.ts`, `apps/web/src/app/(app)/dinner-draft/actions.ts`, the seven meal-plan action/helper/guard modules, `meal-plan/WildcardButton.tsx`, four migrations listed above, this document, and `tests/foundation.test.cjs` / `tests/load-typescript.cjs`.

Core updates: meal-plan compatibility barrel, dashboard wildcard caller, event shopping scaler, Claude parser and serving prompt, shared prompt/exports, Supabase types, and root `package.json` test script. Recovered onboarding updates use the join RPC; recovered family-membership ordering changes span web dashboard/events/family/food-log/layout/meal-plan/onboarding/profile/recipes/shopping and mobile index/profile/shopping/layout. Mobile voting reports database failures. The review handoff includes the complete git status and tracked diff statistics.
