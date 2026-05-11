# NomNate — Final Engineering Review
**Date:** 2026-05-11  
**Session scope:** International store expansion, iPhone PWA icon fix, AI Chef SA-focus, admin dashboard

---

# Executive Summary

**Production readiness: 5/10**  
**Security score: 4/10**  
**Maintainability score: 6/10**  
**Token-efficiency score: 5/10**

### Top 5 highest-risk issues
1. `shopping-list/actions.ts` VALID_STORES hardcoded to ZA — UK/FR families cannot change store assignments (functional breakage + IDOR)
2. Admin email hardcoded as `"kim.ormiston@me.com"` in source — PII in git, inconsistent auth across admin pages
3. `feedback-notify` route has no authentication — anyone can spam admin email and inject HTML content
4. `toggleItem`/`setStore` actions have no family membership verification — IDOR across all authenticated users
5. `removeFromSlot`/`assignRecipeToSlot` don't verify slot ownership — any user can modify any family's meal plan

### Top 5 highest-impact improvements
1. Split `meal-plan/actions.ts` (879 lines) — single biggest token-context savings
2. Move SA_STAPLES seed data out of `recipes/actions.ts` — 300+ inline lines
3. Merge `lib/stores.ts` + `storeUtils.ts` — duplicated store config will diverge
4. Fix VALID_STORES to be country-aware — breaks UK/FR families today
5. Add auth to `/api/feedback-notify`

---

# Critical Findings

### C1 — `shopping-list/actions.ts`: VALID_STORES hardcoded to ZA only
**File:** `apps/web/src/app/(app)/shopping-list/actions.ts:6`
```ts
const VALID_STORES = new Set(["woolworths", "pnp", "checkers"]);
```
**Risk:** UK/FR families click "Save" on any store assignment → `!VALID_STORES.has(store)` → silently returns without saving. The store picker appears to work but never persists for international users. This is a functional regression introduced when international store support was added — the store config moved to `storeUtils.ts` but `actions.ts` was never updated.

**Fix:**
```ts
import { getStoresByCountry } from "./storeUtils";

export async function setStore(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const itemId = String(formData.get("itemId") ?? "");
  const store = String(formData.get("store") ?? "");
  if (!itemId || !store) return;

  // Verify item belongs to a list this user can access, get family country
  const { data: item } = await supabase
    .from("shopping_list_items")
    .select("id, shopping_lists(meal_plans(family_id, families(country)))")
    .eq("id", itemId)
    .single();
  if (!item) return;

  const country = /* extract from nested */ "ZA";
  const validStores = new Set(getStoresByCountry(country).map(s => s.key));
  if (!validStores.has(store)) return;

  await supabase.from("shopping_list_items").update({ store }).eq("id", itemId);
  revalidatePath("/shopping-list");
}
```

---

### C2 — Admin email hardcoded as PII in source
**File:** `apps/web/src/app/(app)/admin/feedback/page.tsx:9` and `admin/feedback/actions.ts:7`
```ts
const ADMIN_EMAIL = "kim.ormiston@me.com";
```
**Risk:** Personal email address committed to git. Will appear in GitHub history, forks, clones, and any future open-sourcing. Creates inconsistency: dashboard uses `process.env.ADMIN_EMAIL`, feedback uses hardcoded constant. An attacker who knows this email could enumerate whether the account exists via auth error messages.

**Fix:**
```ts
// Both files
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
if (!ADMIN_EMAIL || user.email !== ADMIN_EMAIL) redirect("/dashboard");
```

---

### C3 — `/api/feedback-notify` has no authentication
**File:** `apps/web/src/app/api/feedback-notify/route.ts`

No auth check. Any entity on the internet can POST arbitrary `type`, `message`, `userName`, `familyName` to this endpoint and trigger an email to the admin. The `message` field is directly interpolated into HTML without escaping:
```ts
<p style="...">${message}</p>
```
**Risk:** HTML injection into admin email. Email clients that render HTML will execute embedded `<script>` tags or render phishing content. Also: unlimited email spam to the admin at zero cost to the attacker.

**Fix — two-part:**
```ts
// 1. Add a shared secret check
const secret = req.headers.get("x-notify-secret");
if (!secret || secret !== process.env.FEEDBACK_NOTIFY_SECRET) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// 2. HTML-escape all user content before template injection
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
```
The `FeedbackFab` client must pass the secret header (or the route should only be callable server-side via the feedback action, not as a public API at all).

---

# High Priority Findings

### H1 — IDOR: `toggleItem`/`setStore` have no ownership verification
**File:** `apps/web/src/app/(app)/shopping-list/actions.ts`

Both actions update rows by `itemId` with no check that the item belongs to the user's family. Any authenticated user who knows (or guesses) a UUID can toggle any item in any family's shopping list.
```ts
await supabase.from("shopping_list_items").update({ checked }).eq("id", itemId);
// No family membership check before this
```
**Fix:** Join through `shopping_lists → meal_plans → family_id` and verify via RLS or an explicit membership check. Alternatively, enforce this via a Supabase RLS policy on `shopping_list_items` that validates family membership through the join chain. The RLS policy is the more reliable fix since it can't be forgotten.

---

### H2 — IDOR: `removeFromSlot`/`assignRecipeToSlot` don't verify slot ownership
**File:** `apps/web/src/app/(app)/meal-plan/actions.ts:497-559`

`removeFromSlot` updates a slot by `slotId` without verifying the slot belongs to the user's family. `assignRecipeToSlot` validates the recipe is accessible but not the slot.
```ts
export async function removeFromSlot(slotId: string): Promise<string | null> {
  // ... gets user ...
  const { error } = await supabase
    .from("meal_plan_slots")
    .update({ recipe_id: null })
    .eq("id", slotId);  // No family check
```
**Fix:** Verify `slotId → meal_plan_id → family_id` matches the user's `membership.family_id` before updating.

---

### H3 — AI suggestions ignore `dietaryRestrictions` parameter
**File:** `apps/web/src/app/(app)/meal-plan/actions.ts:177-186`
```ts
suggestions = await suggestMeals({
  familySize,
  dietaryRestrictions: [],  // ← hardcoded empty
  cuisinePreferences: allCuisinePrefs,
  ...
  familyMembers,  // ← includes restrictions per-member
});
```
`dietaryRestrictions: []` is hardcoded even though `members` data is fetched. The `familyMembers` context includes per-member restrictions, so the AI does receive them — but the top-level `dietaryRestrictions` passed to `suggestMeals` is always empty. Depending on how `suggestMeals` uses both, family-level diet restrictions may be silently ignored in the aggregate prompt. Same bug exists in `suggestForSlot` (line 659).

**Fix:** Aggregate restrictions from members:
```ts
const allRestrictions = [...new Set(
  (members ?? []).flatMap(m => (m.dietary_restrictions as string[]) ?? [])
)];
// Pass allRestrictions instead of []
```

---

### H4 — `daily-feedback/route.ts`: No LIMIT on feedback query → unbounded Claude call
**File:** `apps/web/src/app/api/cron/daily-feedback/route.ts:44-49`

```ts
const { data: feedback } = await supabase
  .from("feedback")
  .select("id, type, message, page_url, user_id, created_at")
  .eq("reviewed", false)
  .order("created_at", { ascending: true });
  // No .limit()
```
If a spam attack produces thousands of unreviewed feedback rows, the route would attempt to send all of them to Claude in a single prompt. This would: (a) exceed Claude's context window and fail, (b) cost potentially hundreds of dollars, (c) the `max_tokens: 2000` on the response won't help since the input could be enormous.

**Fix:**
```ts
.eq("reviewed", false)
.limit(50)  // Process in batches
.order("created_at", { ascending: true });
```

---

### H5 — `FeedbackFab` bypasses server-side rate limiting and content filtering
**File:** `apps/web/src/components/FeedbackFab.tsx:29-34`

The client component inserts directly into Supabase via the browser client — it does NOT call the `submitFeedback` server action that has `filterText` validation and could have rate limiting. Any authenticated user can submit unlimited feedback of any length with any content.

**Fix:** Replace the direct Supabase insert in `FeedbackFab` with a call to the server action or at minimum add a Supabase RLS policy that rate-limits feedback inserts.

---

### H6 — Admin `listUsers` silently truncates at 200
**File:** `apps/web/src/app/(app)/admin/dashboard/page.tsx:57`
```ts
admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
```
Silently shows only first 200 users with no indication that the list is truncated. At pilot scale this is fine, but should be noted.

**Fix:**
```ts
const authResult = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
// If authResult.data.total > 500, show "Showing 500 of N" warning
```

---

### H7 — `console.log` statements in production code
**Files:**
- `FeedbackFab.tsx:51,63`: `console.log('Calling feedback-notify API...')`, `console.log('feedback-notify response:', ...)`
- `feedback-notify/route.ts:56`: `console.log('Resend result:', JSON.stringify(result))`
- `daily-feedback/route.ts:139`: `console.error(...)` (acceptable, server-side)
- `recipes/actions.ts:578`: `console.error(...)` (acceptable)

The `console.log` in `FeedbackFab.tsx` leaks implementation details to all users' browser consoles. The Resend result logging exposes email delivery metadata.

---

# Medium Priority Findings

### M1 — `lib/stores.ts` and `storeUtils.ts` are duplicate store configs
**Files:** `apps/web/src/lib/stores.ts` (39 lines) and `apps/web/src/app/(app)/shopping-list/storeUtils.ts` (218 lines)

Both define ZA/UK/FR store arrays. They have different interfaces (`Store` vs `StoreConfig`), different field names, and will diverge. `storeUtils.ts` was the original; `lib/stores.ts` was added this session as a simpler version for label lookups.

`lib/stores.ts` is only imported by... nothing critical that `storeUtils.ts` couldn't serve. The `storeUtils.ts` already has `getStoresByCountry`. Merge them.

**Fix:** Add label/emoji accessors to `storeUtils.ts`, delete `lib/stores.ts`.

---

### M2 — Rate limiter TOCTOU race condition
**File:** `apps/web/src/lib/rateLimit.ts:27-34`

```ts
const { data } = await supabase.from("rate_limits").select("count")...
const current = data?.count ?? 0;
if (current >= limit) return false;
await supabase.from("rate_limits").upsert({ ..., count: current + 1 }, ...);
```

Two simultaneous AI suggestion requests both see `count: 0`, both pass the check, both upsert `count: 1`. The limit is ineffective under concurrent load. For a household app this is acceptable, but should be noted.

**Fix for launch:** Use a Postgres function with `FOR UPDATE` lock or an atomic increment:
```sql
INSERT INTO rate_limits (user_id, action, window_start, count)
VALUES ($1, $2, $3, 1)
ON CONFLICT (user_id, action, window_start)
DO UPDATE SET count = rate_limits.count + 1
RETURNING count;
```

---

### M3 — `seedSARecipes` makes N sequential database calls
**File:** `apps/web/src/app/(app)/recipes/actions.ts:546-598`

The seed function loops over 10 SA staples and makes individual `select` + `insert` + `insert ingredients` calls sequentially. That's up to 30 individual DB round-trips.

**Fix:** Batch with `upsert` on an external_id, or check all titles in a single query first.

---

### M4 — `runDailyBrief` uses `NEXT_PUBLIC_SITE_URL` which defaults to production
**File:** `apps/web/src/app/(app)/admin/feedback/actions.ts:33`
```ts
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.nomnate.co.za";
```
On Vercel preview deployments, `NEXT_PUBLIC_SITE_URL` won't be set correctly unless explicitly configured per-deployment. The manual trigger would hit production instead of the preview instance.

**Fix:** Use `VERCEL_URL` (automatically set by Vercel) as secondary fallback:
```ts
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL 
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
```

---

### M5 — Streak computation has timezone fragility
**File:** `apps/web/src/app/(app)/dashboard/page.tsx:12-23`

`computeStreak` uses UTC dates but `wildcardLabel` uses `today.getUTCDay()`. However, votes stored with `created_at` are interpreted as UTC, while users in SA (UTC+2), UK (UTC+0/+1), and FR (UTC+1/+2) may vote at local midnight which maps to different UTC days. A vote cast at 11pm SA time would be stored as the next UTC day, potentially breaking the streak.

**Fix:** Store and compare vote dates in the user's local timezone, or define "a day" as "any calendar day in UTC+2" for the SA-focused app.

---

### M6 — `meal-plan/actions.ts` mid-file import
**File:** `apps/web/src/app/(app)/meal-plan/actions.ts:92-93`
```ts
import { FREE_AI_LIMIT } from "./constants";
import { checkRateLimit } from "@/lib/rateLimit";
```
These imports appear at line 92, mid-file, after several function definitions. All imports should be at the top of the file. Some bundlers handle this correctly but it's misleading and can cause issues with static analysis tools.

---

### M7 — WhatsApp share text uses hardcoded "en-ZA" locale
**File:** `apps/web/src/app/(app)/shopping-list/page.tsx:88`
```ts
new Date(shoppingList.generated_at).toLocaleString("en-ZA", {...})
```
UK and FR users see SA date formatting. Minor UX issue but worth noting given the international expansion.

---

# Low Priority Findings

### L1 — Dead export: `feedback/actions.ts` server action unused
**File:** `apps/web/src/app/(app)/feedback/actions.ts`

The `submitFeedback` server action exists but `FeedbackFab.tsx` inserts directly without calling it. This file is dead code in practice.

### L2 — `browseSouthAfricanMeals` is not rate-limited
**File:** `apps/web/src/app/(app)/recipes/actions.ts:363-369`

Calls the TheMealDB API without rate limiting. Low risk since TheMealDB is free/public.

### L3 — `fetchImageByTitle` silently swallows errors and makes external API call per recipe
**File:** `apps/web/src/app/(app)/meal-plan/actions.ts:84-91`

Called in `suggestWithAI` via `Promise.all(suggestions.map(...))` — up to 7 concurrent Spoonacular calls per AI suggestion batch. If Spoonacular quota is hit, all image fetches fail silently and recipes are saved with `null` images. This is acceptable but should be noted.

### L4 — `storeUtils.ts` Lidl France search URL is wrong
**File:** `apps/web/src/app/(app)/shopping-list/storeUtils.ts:112`
```ts
searchUrl: (q) => `https://www.lidl.fr/c/recherche/${encodeURIComponent(q)}`,
```
Lidl France's actual search URL format is `https://www.lidl.fr/q/${encodeURIComponent(q)}` (as specified in `lib/stores.ts`). The two files disagree on this URL.

### L5 — `lib/stores.ts` is imported nowhere
**File:** `apps/web/src/lib/stores.ts`

The file was committed but the shopping list page imports from `./storeUtils.ts`, not from `@/lib/stores`. This file currently has zero importers and is dead code.

### L6 — `generateShoppingList` deletes then re-creates on every invocation
**File:** `apps/web/src/app/(app)/meal-plan/actions.ts:477-484`
```ts
await supabase.from("shopping_lists").delete().eq("meal_plan_id", plan.id);
```
Deletes the whole list before rebuilding. If the `insert` of the new list fails partway through, the user is left with no shopping list and no error recovery path.

### L7 — `saveChefRecipe` has no AI usage rate limiting
**File:** `apps/web/src/app/(app)/recipes/ai-chef-actions.ts:190-241`

Saving a Chef recipe is not rate-limited. The chat itself is not rate-limited either (`chatWithChef` has no rate limit call). A user could hold a conversation and generate/save recipes indefinitely.

---

# Token Efficiency Audit

### Largest token-waste areas

| File | Lines | AI Session Cost | Issue |
|------|-------|----------------|-------|
| `meal-plan/actions.ts` | 879 | Very High | 6 unrelated concerns in one file |
| `recipes/actions.ts` | 710 | Very High | SA_STAPLES inline data (300 lines), search, library, seeding |
| `shopping-list/storeUtils.ts` | 218 | Medium | WOOLWORTHS_TERMS (45 lines), PNP_TERMS (55 lines) |
| `daily-feedback/route.ts` | 214 | Medium | Long email HTML template inline |
| `admin/dashboard/page.tsx` | 353 | Medium | New, dense but appropriately scoped |

### Recommended file splits (highest ROI)

**1. Split `meal-plan/actions.ts` → 5 files** (~500 token reduction per AI session involving meal plan work)
```
meal-plan/
  ai-actions.ts        (suggestWithAI, suggestForSlot, getAIUsageThisWeek)
  plan-actions.ts      (generatePlan, resetPlan)
  shopping-actions.ts  (generateShoppingList)
  vote-actions.ts      (castVote)
  slot-actions.ts      (removeFromSlot, assignRecipeToSlot)
```

**2. Extract SA_STAPLES from `recipes/actions.ts`** (~280 token reduction)
```ts
// recipes/seed-data.ts
export const SA_STAPLES = [...]

// recipes/actions.ts
import { SA_STAPLES } from "./seed-data";
```

**3. Extract keyword lists from `storeUtils.ts`** (~100 token reduction)
```ts
// shopping-list/store-keywords.ts
export const WOOLWORTHS_TERMS = [...]
export const PNP_TERMS = [...]
```

**4. Merge `lib/stores.ts` into `storeUtils.ts`** — eliminates a confusing dead-code file

**5. Consistent action file pattern** — Currently action files range from 34 lines (`family/actions.ts`) to 879 lines. Target ~150 lines per actions file.

---

# Recommended Refactor Plan

### Immediate (before next deploy)
1. **Fix `VALID_STORES` in `shopping-list/actions.ts`** — breaks UK/FR today
2. **Remove hardcoded admin email from `admin/feedback/page.tsx` and `actions.ts`** — use `process.env.ADMIN_EMAIL`
3. **Add auth to `/api/feedback-notify`** — shared secret header
4. **Add `LIMIT 50` to feedback cron query** — prevent runaway Claude costs
5. **Remove `console.log` from `FeedbackFab.tsx`**

### Short-term (this week)
6. **Fix IDOR in `toggleItem`/`setStore`** — add family membership verification
7. **Fix IDOR in `removeFromSlot`/`assignRecipeToSlot`** — verify slot ownership
8. **Fix `dietaryRestrictions: []` in both `suggestWithAI` and `suggestForSlot`**
9. **Delete `lib/stores.ts`** (dead code) or wire it up properly by removing `storeUtils.ts`
10. **Move SA_STAPLES to `recipes/seed-data.ts`**

### Before public launch
11. **Split `meal-plan/actions.ts`** into 5 focused files
12. **Add AI Chef rate limiting** (`chatWithChef` and `saveChefRecipe`)
13. **Fix rate limiter TOCTOU** — atomic Postgres increment
14. **Fix WhatsApp/date locale** for UK/FR users
15. **Fix Lidl FR search URL** discrepancy between `storeUtils.ts` and `lib/stores.ts`
16. **Route `FeedbackFab` through `submitFeedback` server action** (or delete the orphaned action)

### Long-term
17. **Add RLS policies for `shopping_list_items`** — enforce family membership at DB level
18. **Add RLS policies for `meal_plan_slots`** — prevent cross-family slot manipulation
19. **Paginate admin `listUsers`** — handle >200 users
20. **Add `FEEDBACK_NOTIFY_SECRET` env var** and update `FeedbackFab` to send it

---

# Production Readiness Verdict

**Not safe for unrestricted public launch in current state. Safe for continued closed pilot with trusted users.**

The IDOR vulnerabilities (H1, H2) are not exploitable by trusted pilot users, but would be a clear path to cross-family data manipulation if an adversarial user were admitted. The `feedback-notify` endpoint (C3) is exploitable by anyone right now and should be fixed before expanding.

| Area | Status |
|------|--------|
| Auth & sessions | ✅ Supabase handles correctly |
| Core RLS policies | ✅ Present on primary tables |
| PWA / iPhone icon | ✅ Fixed this session |
| International stores | ✅ Config correct, ⚠️ VALID_STORES broken (C1) |
| AI Chef SA focus | ✅ Updated this session |
| Admin dashboard | ✅ Gated behind email check |
| Shopping list IDOR | ❌ No ownership verification (H1) |
| Meal plan IDOR | ❌ No slot ownership check (H2) |
| Feedback notify | ❌ Unauthenticated, HTML injectable (C3) |
| Admin email PII | ❌ Hardcoded in git (C2) |
| Dietary restrictions | ❌ Hardcoded `[]` in AI prompts (H3) |
| Rate limiting | ⚠️ TOCTOU race, no Chef limit (M2, L7) |

**Fix C1 + C2 + C3 before the next invite wave.**
