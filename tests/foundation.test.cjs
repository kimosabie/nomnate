const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, client } = require('./load-typescript.cjs');
const domain = load('packages/shared/src/dinnerDraft.ts');
const shopping = load('apps/web/src/lib/mealShopping.ts');
const ai = load('packages/shared/src/recipeValidation.ts');
const candidates = [{ id: 'a' }, { id: 'b' }];
const vote = (candidateId, reaction, familyMemberId = 'member') => ({ candidateId, reaction, familyMemberId });
const draft = { id: 'draft', familyId: 'family', createdBy: 'user', status: 'open' };
const member = { userId: 'user', familyId: 'family', role: 'member' };
const input = () => ({ userId: 'user', activeFamilyId: 'family', member, draft, candidates, votes: [vote('a', 'love')] });
const ok = (data) => ({ data, error: null });

for (const [reaction, score] of [['love', 3], ['eat', 1], ['whatever', 0], ['nope', -3]]) {
  test(`${reaction} scores ${score}`, () => {
    const result = domain.scoreDraft([{ id: 'a' }], [vote('a', reaction)]);
    assert.equal(result.scores[0].score, score);
    assert.equal(result.scores[0].reactions[reaction], 1);
  });
}
test('winner and per-candidate/total counts include all reactions', () => {
  const result = domain.scoreDraft(candidates, [vote('a', 'love'), vote('a', 'eat', 'second'), vote('b', 'whatever')]);
  assert.equal(result.winner, 'a');
  assert.equal(result.tied, false);
  assert.equal(result.voteCount, 3);
  assert.deepEqual(result.scores.map((s) => [s.score, s.voteCount]), [[4, 2], [0, 1]]);
});
test('ties remain explicit regardless of candidate ordering', () => {
  const result = domain.scoreDraft([...candidates].reverse(), [vote('a', 'love'), vote('b', 'love')]);
  assert.equal(result.winner, null);
  assert.equal(result.tied, true);
  assert.deepEqual(result.tiedCandidateIds, ['a', 'b']);
  assert.throws(() => domain.requireDraftWinner(result), /unresolved tie/);
});
test('empty and unvoted drafts have no finalisable winner', () => {
  for (const list of [[], [{ id: 'a' }], candidates]) {
    const result = domain.scoreDraft(list, []);
    assert.equal(result.winner, null);
    assert.throws(() => domain.requireDraftWinner(result), /no candidates|no votes/);
  }
});
test('duplicate member/candidate votes reject; reacting to different candidates is allowed', () => {
  assert.throws(() => domain.scoreDraft(candidates, [vote('a', 'love'), vote('a', 'eat')]), /Duplicate vote/);
  assert.equal(domain.scoreDraft(candidates, [vote('a', 'love'), vote('b', 'eat')]).voteCount, 2);
  assert.throws(() => domain.scoreDraft(candidates, [vote('missing', 'love')]), /unknown candidate/);
});
for (const [name, change, message] of [
  ['unresolved tie', { votes: [vote('a', 'love'), vote('b', 'love')] }, /tie/],
  ['non-member', { member: null }, /member/],
  ['another family', { draft: { ...draft, familyId: 'other' } }, /active family/],
  ['another user', { member: { ...member, userId: 'other' } }, /member/],
  ['ordinary non-creator', { draft: { ...draft, createdBy: 'other' } }, /planner|admin/],
  ['finalised draft', { draft: { ...draft, status: 'finalised' } }, /not open/],
  ['cancelled draft', { draft: { ...draft, status: 'cancelled' } }, /not open/],
]) {
  test(`finalisation refuses ${name} before persistence`, async () => {
    let persisted = false;
    await assert.rejects(domain.finaliseDraftWith({ ...input(), ...change }, async () => { persisted = true; }), message);
    assert.equal(persisted, false);
  });
}
test('successful finalisation persists exact winner intent and returns transactional result', async () => {
  const intents = [];
  const result = await domain.finaliseDraftWith(input(), async (intent) => {
    intents.push(intent); return { winner: intent.expected_winner, committedSlotId: 'slot' };
  });
  assert.deepEqual(intents, [{ draft_id: 'draft', expected_winner: 'a' }]);
  assert.equal(result.winner, 'a');
  assert.equal(result.committedSlotId, 'slot');
});
test('admin can finalise another planner draft; transaction failures propagate', async () => {
  const adminInput = { ...input(), member: { ...member, role: 'admin' }, draft: { ...draft, createdBy: 'other' } };
  assert.equal(await domain.finaliseDraftWith(adminInput, async () => 'saved'), 'saved');
  await assert.rejects(domain.finaliseDraftWith(adminInput, async () => { throw new Error('results changed'); }), /results changed/);
});
test('committed and legacy confirmed meals reject edits; suggested meals allow edits', () => {
  assert.throws(() => domain.assertMutableMeal({ status: 'confirmed' }), /committed/);
  assert.throws(() => domain.assertMutableMeal({ status: 'suggested', committed_draft_id: 'draft' }), /committed/);
  assert.doesNotThrow(() => domain.assertMutableMeal({ status: 'suggested', committed_draft_id: null }));
});
test('repeated recipe occurrences multiply quantities and apply event serving scaling', () => {
  const result = shopping.scaleShoppingIngredients(['r', 'r'], [{ id: 'r', servings: 2 }], [
    { recipe_id: 'r', name: 'rice', quantity: 100, unit: 'g' },
    { recipe_id: 'r', name: 'salt', quantity: null, unit: null },
  ], 4);
  assert.equal(result.filter((i) => i.name === 'rice').reduce((total, i) => total + i.quantity, 0), 400);
  assert.equal(result.filter((i) => i.quantity === null).length, 2);
});
const slot = (id, option, extra = {}) => ({ id, day_of_week: 0, course: 'main', option_number: option, recipe_id: id, status: 'suggested', ...extra });
test('committed decision outranks lowest option and confirmed fallback', () => {
  assert.deepEqual(shopping.selectShoppingRecipes([slot('low', 1), slot('winner', 3, { status: 'confirmed', committed_draft_id: 'draft' })]), ['winner']);
  assert.deepEqual(shopping.selectShoppingRecipes([slot('low', 1), slot('confirmed', 2, { status: 'confirmed' })]), ['confirmed']);
  assert.deepEqual(shopping.selectShoppingRecipes([slot('low', 1), slot('other', 2)]), ['low']);
  assert.deepEqual(shopping.selectShoppingRecipes([slot('r', 1), slot('r', 1, { day_of_week: 1 })]), ['r', 'r']);
});
test('conflicting or malformed commitments fail closed', () => {
  assert.throws(() => shopping.selectShoppingRecipes([slot('a', 1, { committed_draft_id: 'd' })]), /Invalid committed/);
  assert.throws(() => shopping.selectShoppingRecipes([slot('a', 1, { status: 'confirmed' }), slot('b', 2, { status: 'confirmed' })]), /Multiple confirmed/);
});
const recipe = { title: 'Rice bowl', cuisine: 'Fusion', prep_time: 20, instructions: 'Boil rice, then serve.', ingredients: [{ name: 'rice', quantity: 100, unit: 'g' }] };
test('valid planner JSON and fenced JSON parse', () => {
  assert.deepEqual(ai.parseGeneratedRecipes(JSON.stringify([recipe])), [recipe]);
  assert.deepEqual(ai.parseGeneratedRecipes('```json\n' + JSON.stringify([recipe]) + '\n```'), [recipe]);
});
test('malformed JSON and invalid recipe collections fail validation', () => {
  for (const text of ['oops', '{}', '[]']) assert.throws(() => ai.parseGeneratedRecipes(text));
  assert.throws(() => ai.validateGeneratedRecipes([recipe, recipe]), /Duplicate/);
  assert.throws(() => ai.validateGeneratedRecipes([{ ...recipe, prep_time: -1 }]), /prep_time/);
});
for (const field of ['title', 'ingredients', 'instructions']) {
  test(`planner contract requires ${field}`, () => {
    const invalid = { ...recipe }; delete invalid[field];
    assert.throws(() => ai.validateGeneratedRecipes([invalid]), new RegExp(field));
  });
}

function actionMocks(db, effects) {
  return {
    '@/lib/supabase/server': { createClient: async () => db },
    'next/cache': { revalidatePath: () => {} },
    'next/navigation': { redirect: (url) => { throw new Error('redirect:' + url); } },
    '@nomnate/lib/claude': { suggestMeals: async () => { effects.push('claude'); return [recipe]; } },
    '@nomnate/lib/spoonacular': { searchRecipes: async () => { effects.push('image'); return []; } },
    '@/lib/rateLimit': { checkRateLimit: async () => { effects.push('rateLimit'); return true; } },
  };
}
for (const [name, membership, target] of [
  ['missing membership', null, null],
  ['missing slot', { family_id: 'family' }, null],
  ['another family slot', { family_id: 'family' }, { ...slot('s', 1), meal_plans: { family_id: 'other' } }],
  ['committed slot', { family_id: 'family' }, { ...slot('s', 1, { status: 'confirmed', committed_draft_id: 'd' }), meal_plans: { family_id: 'family' } }],
]) {
  test(`slot AI rejects ${name} before all external side effects`, async () => {
    const db = client({ family_members: [ok(membership)], meal_plan_slots: [ok(target)] });
    const effects = [];
    const action = load('apps/web/src/app/(app)/meal-plan/actions/ai-actions.ts', actionMocks(db, effects));
    const result = await action.suggestForSlot('s');
    assert.ok(result.error);
    assert.deepEqual(effects, []);
    assert.ok(!db.calls.some((c) => c.methods?.some(([m]) => ['insert', 'update', 'upsert'].includes(m))));
  });
}
test('slot lookup database errors abort before Claude', async () => {
  const db = client({ family_members: [ok({ family_id: 'family' })], meal_plan_slots: [{ data: null, error: { message: 'lookup failed' } }] });
  const effects = [];
  const action = load('apps/web/src/app/(app)/meal-plan/actions/ai-actions.ts', actionMocks(db, effects));
  assert.deepEqual(await action.suggestForSlot('s'), { error: 'lookup failed' });
  assert.deepEqual(effects, []);
});
test('guarded mutation reports database failures and zero-row races explicitly', async () => {
  const db = client({ meal_plan_slots: [{ data: null, error: { message: 'committed by another request' } }, ok(null), ok({ id: 's' })] });
  const { updateMutableSlot } = load('apps/web/src/app/(app)/meal-plan/actions/guards.ts', actionMocks(db, []));
  assert.match(await updateMutableSlot(db, 's', 'r'), /committed/);
  assert.match(await updateMutableSlot(db, 's', 'r'), /Refresh/);
  assert.equal(await updateMutableSlot(db, 's', 'r'), null);
  assert.ok(db.calls.every((c) => c.methods.some(([m, col, val]) => m === 'neq' && col === 'status' && val === 'confirmed')));
});
test('reset rejects a committed meal without deleting slots, votes or shopping', async () => {
  const db = client({ family_members: [ok({ family_id: 'family' })], meal_plans: [ok({ id: 'plan' })], meal_plan_slots: [ok([slot('s', 1, { status: 'confirmed' })])] });
  const action = load('apps/web/src/app/(app)/meal-plan/actions/plan-actions.ts', actionMocks(db, []));
  assert.match(await action.resetPlan(null, new FormData()), /committed/);
  assert.ok(!db.calls.some((c) => c.methods?.some(([m]) => m === 'delete')));
});
test('real finalisation action sends the authoritative winner intent to the RPC', async () => {
  const db = client({
    active_family_id: [ok('family')],
    family_members: [ok({ user_id: 'user', family_id: 'family', role: 'member' })],
    dinner_drafts: [ok({ id: 'draft', family_id: 'family', created_by: 'user', status: 'open' })],
    draft_candidates: [ok(candidates)],
    draft_votes: [ok([{ candidate_id: 'a', family_member_id: 'member', reaction: 'love' }])],
    finalise_dinner_draft: [ok({ winner: 'a', committedSlotId: 's' })],
  });
  const action = load('apps/web/src/app/(app)/dinner-draft/actions.ts', actionMocks(db, []));
  assert.deepEqual(await action.finaliseDinnerDraft('draft'), { result: { winner: 'a', committedSlotId: 's' } });
  assert.deepEqual(db.calls.find((c) => c.rpc === 'finalise_dinner_draft').args, { draft_id: 'draft', expected_winner: 'a' });
});
test('membership database errors abort slot AI even when a partial row is returned', async () => {
  const db = client({ family_members: [{ data: { family_id: 'family' }, error: { message: 'membership failed' } }] });
  const effects = [];
  const action = load('apps/web/src/app/(app)/meal-plan/actions/ai-actions.ts', actionMocks(db, effects));
  assert.deepEqual(await action.suggestForSlot('s'), { error: 'membership failed' });
  assert.deepEqual(effects, []);
});
for (const raced of [false, true]) {
  test(`authorized slot AI ${raced ? 'reports a commitment race' : 'saves the family serving count'}`, async () => {
    const db = client({
      family_members: [ok({ family_id: 'family' }), ok([{}, {}])],
      meal_plan_slots: [ok({ ...slot('s', 1), meal_plan_id: 'plan', meal_plans: { family_id: 'family' } }), ok([]), ok(raced ? null : { id: 's' })],
      ai_usage: [{ count: 0, error: null }, ok(null)],
      recipes: [ok([]), ok({ id: 'new', title: recipe.title })],
      family_recipes: [ok([]), ok(null)],
      recipe_ingredients: [ok(null)],
    });
    const effects = [];
    const action = load('apps/web/src/app/(app)/meal-plan/actions/ai-actions.ts', actionMocks(db, effects));
    const result = await action.suggestForSlot('s');
    assert.deepEqual(effects, ['rateLimit', 'claude', 'image']);
    const save = db.calls.find((c) => c.table === 'recipes' && c.methods.some(([m]) => m === 'insert'));
    assert.equal(save.methods.find(([m]) => m === 'insert')[1].servings, 2);
    if (raced) assert.match(result.error, /committed|Refresh/);
    else assert.equal(result.recipe.id, 'new');
  });
}
test('wildcard returns a visible commitment error before changing a recipe', async () => {
  const db = client({
    family_members: [ok({ family_id: 'family' })], meal_plans: [ok({ id: 'plan' })],
    meal_plan_slots: [ok({ id: 's' }), ok({ ...slot('s', 1, { status: 'confirmed' }), meal_plans: { family_id: 'family' } })],
  });
  const action = load('apps/web/src/app/(app)/meal-plan/actions/plan-actions.ts', actionMocks(db, []));
  assert.match(await action.pickWildcardMeal(null, new FormData()), /committed/);
  assert.ok(!db.calls.some((c) => c.methods?.some(([m]) => m === 'update')));
});

for (const actionName of ['suggestWithAI', 'planWeekWithAI', 'suggestForSlot']) {
  for (const readFails of [true, false]) {
    test(`${actionName} rejects ${readFails ? 'failed' : 'empty'} family-context reads before paid AI`, async () => {
      const familyContext = readFails ? { data: null, error: { message: 'context unavailable' } } : ok([]);
      const db = client({
        family_members: [ok({ family_id: 'family' }), familyContext],
        ai_usage: [{ count: 0, error: null }],
        meal_plans: [ok({ id: 'plan' })],
        meal_plan_slots: [ok(actionName === 'suggestForSlot'
          ? { ...slot('s', 1), meal_plan_id: 'plan', meal_plans: { family_id: 'family' } }
          : [{ id: 's', day_of_week: 0, option_number: 1 }])],
      });
      const effects = [];
      const actions = load('apps/web/src/app/(app)/meal-plan/actions/ai-actions.ts', actionMocks(db, effects));
      const result = actionName === 'suggestForSlot' ? await actions[actionName]('s')
        : actionName === 'suggestWithAI' ? await actions[actionName](null, new FormData()) : await actions[actionName]();
      assert.match(typeof result === 'string' ? result : result.error, /family preferences|No family members/);
      assert.ok(!effects.includes('claude'));
      assert.ok(!effects.includes('image'));
      assert.ok(!db.calls.some((c) => c.methods?.some(([m]) => ['insert', 'update', 'upsert'].includes(m))));
    });
  }
}

for (const field of ['prep_time', 'cook_time', 'servings', 'calories_per_serving', 'protein_g', 'carbs_g', 'fat_g']) {
  test(`AI validation rejects fractional integer column ${field}`, () => {
    assert.throws(() => ai.validateGeneratedRecipes([{ ...recipe, [field]: 1.5 }]), new RegExp(field));
    assert.equal(ai.validateGeneratedRecipes([{ ...recipe, [field]: 2 }])[0][field], 2);
  });
}
test('AI ingredient quantities retain decimals', () => {
  assert.equal(ai.validateGeneratedRecipes([{ ...recipe, ingredients: [{ name: 'rice', quantity: 0.25, unit: 'cup' }] }])[0].ingredients[0].quantity, 0.25);
});
test('anonymised creator requires an admin to finalise', () => {
  const args = { ...input(), draft: { ...draft, createdBy: null } };
  assert.throws(() => domain.assertCanFinalise(args.userId, args.activeFamilyId, args.member, args.draft), /planner|admin/);
  assert.doesNotThrow(() => domain.assertCanFinalise(args.userId, args.activeFamilyId, { ...args.member, role: "admin" }, args.draft));
});
for (const fails of [true, false]) {
  test(`account deletion ${fails ? 'failure leaves ownership untouched' : 'delegates succession to database deletion'}`, async () => {
    const db = client({});
    const deleted = [];
    const actions = load('apps/web/src/app/(app)/profile/actions.ts', {
      ...actionMocks(db, []),
      '@/lib/supabase/admin': { createAdminClient: () => ({ auth: { admin: { deleteUser: async (id) => {
        deleted.push(id); return { error: fails ? { message: 'Auth deletion failed' } : null };
      } } } }) },
    });
    const form = new FormData(); form.set('confirmation', 'DELETE');
    if (fails) assert.equal(await actions.deleteAccount(null, form), 'Auth deletion failed');
    else await assert.rejects(actions.deleteAccount(null, form), /redirect:.*account_deleted/);
    assert.deepEqual(deleted, ['user']);
    assert.deepEqual(db.calls, []); // No transfer can precede a failed external call.
  });
}
for (const failure of ['recipes', 'family_recipes', 'both', 'none']) {
  test(`library reset reports ${failure} deletion outcome and invalidates partial changes`, async () => {
    const fail = (table) => failure === table || failure === 'both' ? { data: null, error: { message: table + ' delete failed' } } : ok(null);
    const db = client({ family_members: [ok({ family_id: 'family' })], recipes: [fail('recipes')], family_recipes: [fail('family_recipes')] });
    const paths = [];
    const actions = load('apps/web/src/app/(app)/recipes/actions.ts', {
      ...actionMocks(db, []), 'next/cache': { revalidatePath: (path) => paths.push(path) },
      '@/lib/nutrition': {}, '@nomnate/lib/themealdb': {},
    });
    const result = await actions.resetRecipeLibrary();
    if (failure === 'none') assert.equal(result, null);
    else {
      assert.match(result, /reset incomplete/);
      if (failure === 'both') { assert.match(result, /recipes delete failed/); assert.match(result, /family_recipes delete failed/); }
      else assert.ok(result.includes(failure + ' delete failed'));
    }
    assert.deepEqual(paths, ['/recipes', '/meal-plan']);
  });
}
for (const failure of ['recipe', 'ingredients', 'assignment', 'throw', 'usage', 'none', 'first']) {
  test(`weekly AI handles ${failure} persistence outcome with consistent usage and cache`, async () => {
    const err = { data: null, error: { message: 'injected failure' } };
    const db = client({
      family_members: [ok({ family_id: 'family' }), ok([{}])],
      ai_usage: [{ count: 0, error: null }, failure === 'usage' ? err : ok(null)],
      meal_plans: [ok({ id: 'plan' })],
      meal_plan_slots: [ok([{ id: 's1', day_of_week: 0, option_number: 1 }, { id: 's2', day_of_week: 1, option_number: 1 }]), ok([])],
      recipes: [ok([]), failure === 'first' ? err : ok({ id: 'r1' }), failure === 'recipe' ? err : ok({ id: 'r2' })],
      recipe_ingredients: [ok(null), failure === 'ingredients' ? err : ok(null)],
      family_recipes: [ok([])],
    });
    const paths = []; let assignments = 0;
    const actions = load('apps/web/src/app/(app)/meal-plan/actions/ai-actions.ts', {
      ...actionMocks(db, []), 'next/cache': { revalidatePath: (path) => paths.push(path) },
      '@nomnate/lib/claude': { suggestMeals: async () => [recipe, { ...recipe, title: 'Second meal' }] },
      './guards': { actionError: (e) => e.message, updateMutableSlot: async () => {
        assignments++;
        if (assignments === 2 && failure === 'throw') throw new Error('injected failure');
        return assignments === 2 && failure === 'assignment' ? 'injected failure' : null;
      } },
    });
    const result = await actions.planWeekWithAI();
    if (failure === 'none') assert.equal(result, null);
    else {
      assert.match(result, new RegExp(`Saved ${failure === 'first' ? 0 : failure === 'usage' ? 2 : 1} of 2 meals`));
      assert.match(result, /injected failure/);
    }
    assert.deepEqual(paths, ['/meal-plan']);
    const usage = db.calls.filter((c) => c.table === 'ai_usage' && c.methods.some(([m]) => m === 'insert'));
    assert.equal(usage.length, failure === 'first' ? 0 : 1);
    if (usage.length) assert.equal(usage[0].methods.find(([m]) => m === 'insert')[1][0].kind, 'week_plan');
  });
}

for (const fractional of [true, false]) {
  test(`AI Chef ${fractional ? 'rejects fractional cook time before writes' : 'accepts integers and decimal ingredients'}`, async () => {
    const db = client({ family_members: [ok({ family_id: 'family' })], recipes: [ok({ id: 'r' })], recipe_ingredients: [ok(null)] });
    const actions = load('apps/web/src/app/(app)/recipes/ai-chef-actions.ts', actionMocks(db, []));
    const result = await actions.saveChefRecipe({ ...recipe, servings: 2, cook_time: fractional ? 2.5 : 2,
      instructions: ['Boil rice.'], ingredients: [{ name: 'rice', quantity: 0.25, unit: 'cup' }] });
    if (fractional) { assert.match(result.error, /cook_time/); assert.deepEqual(db.calls, []); }
    else { assert.equal(result.error, null); assert.equal(result.id, 'r'); }
  });
}
test('manual recipe deletion cannot report success for a filtered or missing row', async () => {
  const db = client({ family_members: [ok({ family_id: 'family' })], recipes: [ok({ id: 'r', is_global: false }), ok(null)] });
  const actions = load('apps/web/src/app/(app)/recipes/actions.ts', {
    ...actionMocks(db, []), '@/lib/nutrition': {}, '@nomnate/lib/themealdb': {},
  });
  assert.match(await actions.deleteRecipe('r'), /not deleted/);
});
