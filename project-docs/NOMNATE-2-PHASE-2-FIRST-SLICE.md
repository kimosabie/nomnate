# Phase 2: authenticated Dinner Draft first slice

Implemented flow: `/tonight` → confirm dinner date → atomically select three existing library meals → `/dinner-draft/[draftId]` → authenticated household reactions → creator/admin reviews scores and explicit ties → Phase 1 finalisation commits the winner → `/tonight?date=YYYY-MM-DD` reads the confirmed meal-plan slot.

`/dashboard` redirects to `/tonight`; main Home/logo navigation targets Tonight. `/meal-plan` remains available.

## Implementation

- `start_dinner_draft(date)` resolves auth and active family internally, serializes starts for family/date, resumes existing unexpired open drafts, rejects already committed dinners and short libraries, and creates the draft plus exactly three candidates in one transaction.
- Library selection includes family-owned recipes and saved shared recipes, requires nonblank title/instructions and ingredients with valid basic values, excludes other courses, requires an explicit main course and orders by least-recent family nomination, then favourites, then recipe ID. Unclassified recipes are excluded rather than guessed to be dinner. Selection is reproducible and rotates when more than three eligible meals exist; this slice has no AI or reroll.
- Restrictive RLS policies make Tonight creation and candidate mutations RPC-only, so clients cannot bypass atomic creation or alter its three-candidate set. Phase 1 weekly write policies are preserved. Existing malformed Tonight decisions are retained but rejected by the resume RPC.
- The existing library picker has no reusable dietary/allergy matcher. This slice preserves family-library membership and favourite data; it does not claim that library recipes have been checked against allergies or dietary needs.
- `dinnerContext` and `loadDinnerDraft` enforce authenticated active-family reads; RLS and existing triggers remain the write boundary.
- `reactToDinnerCandidate` validates the shared reaction enum and upserts only the server-resolved member's reaction. Refresh follows mutations; other members' changes appear on manual refresh.
- `finaliseDinnerDraft` retains the Phase 1 service/RPC and checks the displayed winner against the freshly scored result. `finishDinnerDraft` handles navigation using the persisted candidate date. Shopping invalidation stays unchanged.
- `DraftExperience`, `CandidateCard`, `ReactionButtons`, `DraftResults`, and `StartDinnerDraftForm` provide the mobile-first UI. Finalised scores come from the persisted result.
- Household dates use `families.timezone`, falling back to its existing Africa/Johannesburg default. Invalid query dates show a message and today's household date.

## Verification

Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm --filter @nomnate/web build`, and `git diff --check`.

The focused unit tests are `tests/dinner-draft-ux.test.cjs`; existing Phase 1 tests remain in place. `tests/db/dinner-draft-verification.py` verifies actual RLS, creation atomicity, simultaneous starts, eligibility, reactions, ties, permissions, persisted score/commitment, closed/expired drafts, and competing commitments.

The DB script deliberately targets only `supabase_db_nomnate-phase2-verify`. Start a fresh disposable Supabase project with project_id `nomnate-phase2-verify`, the repository migrations, and separate ports (56321 API, 56322 DB, 56320 shadow). Run `python3 tests/db/dinner-draft-verification.py` once against the fresh database. No application env files or remote connection strings are read by the script. The verification instance for this implementation is under `/tmp/nomnate-phase2-verify`.

## Manual browser checks

1. On a local app connected to a disposable database, sign in as a family member with at least three complete recipes explicitly classified as main course. Open `/tonight` at a narrow mobile width and confirm the displayed date.
2. Start a draft, confirm three distinct cards, and retry starting the same date in another tab: it should resume the same draft.
3. Sign in as another member of the same family in another browser profile. React and change a reaction; check the selected button. Refresh the planner view to see participation and scores.
4. Give two candidates equal leading scores: verify “Too close to call” and no finalise button. Create a clear winner and finalise as the creator/admin.
5. Confirm the redirect to Tonight shows the committed recipe and `/meal-plan` contains it. Refresh both pages and verify persistence.
6. Check a family with fewer than three eligible ideas, a different-family draft URL, a closed draft, and an expired draft. Check an ordinary non-creator cannot finalise.
7. Open `/tonight?date=2026-09-20`, an invalid date, and `/dashboard`. Verify date handling and the compatibility redirect.

No browser screenshots or authenticated browser session were captured during implementation. Excluded later-phase features remain unimplemented.

## Final pre-commit review

Fixed expired finalisation at the service and DB write boundary (including transactional rollback); the direct-client Tonight creation/candidate-mutation bypass; deterministic repeat trios; unsafe unclassified-course fallback; no-family direct draft URL handling; ambiguous reaction group names; and provisional wording on finalised results. Selected recipe rows are locked during creation to prevent concurrent recipe edits/deletion changing eligibility before snapshots are captured.

The additive Phase 2 migration was tested both on a fresh database and over populated Phase 1 data. `tests/db/dinner-draft-upgrade-verification.py` runs against the same isolated container before the new migration, seeds Phase 1 data, applies the new migration, checks a pre-existing three-candidate Tonight draft resumes, and runs the Phase 1 retention checks. It never touches remote databases or historical migration files.

Final review validation: 91 unit tests passed (22 slice-specific), lint passed, workspace typecheck passed, web build passed, and git diff --check passed. The final migration passed 45 Dinner Draft database checks on both fresh and upgraded databases, plus 58 upgrade/Phase 1 retention checks. RPC date/UUID signature matches the checked-in string argument/return types. No historical migrations were edited. Authenticated browser/mobile/keyboard smoke testing remains a manual follow-up before release.
