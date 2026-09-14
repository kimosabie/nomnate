const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, client } = require('./load-typescript.cjs');
const dates = load('packages/shared/src/householdDate.ts');
const ok = data => ({ data, error: null });
const member = { id: 'member', user_id: 'user', family_id: 'family', role: 'member' };
const draft = { id: 'draft', family_id: 'family', created_by: 'user', status: 'open', expires_at: null };
const context = extra => ({ active_family_id: [ok('family')], family_members: [ok(member)], ...extra });
function mocks(db) { return { '@/lib/supabase/server': { createClient: async () => db }, 'next/cache': { revalidatePath() {} }, 'next/navigation': { redirect(url) { throw new Error('redirect:' + url); } } }; }
function actions(db) { return load('apps/web/src/app/(app)/dinner-draft/actions.ts', mocks(db)); }
function form(date = '2026-09-14') { const f = new FormData(); f.set('date', date); f.set('family_id', 'attacker'); f.set('created_by', 'attacker'); return f; }
test('household normal day and boundaries in both directions', () => {
  assert.equal(dates.householdToday('Africa/Johannesburg', new Date('2026-09-14T12:00:00Z')), '2026-09-14');
  assert.equal(dates.householdToday('Africa/Johannesburg', new Date('2026-09-14T23:30:00Z')), '2026-09-15');
  assert.equal(dates.householdToday('America/Los_Angeles', new Date('2026-09-14T01:00:00Z')), '2026-09-13');
  assert.equal(dates.householdToday('invalid', new Date('2026-09-14T23:30:00Z')), '2026-09-15');
  assert.deepEqual(dates.dinnerWeek('2026-09-20'), { weekStart: '2026-09-14', dayOfWeek: 6 });
});
test('strict calendar date validation', () => {
  for (const value of ['2026-02-30', 'bad', '2026-9-1', '0000-01-01', null]) assert.equal(dates.validDinnerDate(value), false);
  assert.equal(dates.validDinnerDate('2028-02-29'), true);
});
test('creation requires authentication before RPC', async () => {
  const db = client({}, null);
  assert.match(await actions(db).startDinnerDraft(null, form()), /authenticated/);
  assert.equal(db.calls.length, 0);
});
test('creation resolves identity server-side and redirects to created/resumed RPC draft', async () => {
  const db = client(context({ start_dinner_draft: [ok('existing-draft')] }));
  await assert.rejects(actions(db).startDinnerDraft(null, form()), /redirect:\/dinner-draft\/existing-draft/);
  assert.deepEqual(db.calls.find(c => c.rpc === 'start_dinner_draft').args, { dinner_date: '2026-09-14' });
});
test('thin library and database failures are shown without redirect', async () => {
  const db = client(context({ start_dinner_draft: [{ data: null, error: { message: 'NomNate needs at least 3 dinner ideas before we can start a Draft.' } }] }));
  assert.match(await actions(db).startDinnerDraft(null, form()), /at least 3/);
});
test('invalid date rejects before any database call', async () => {
  const db = client({}); assert.match(await actions(db).startDinnerDraft(null, form('2026-02-31')), /valid dinner date/); assert.equal(db.calls.length, 0);
});
for (const reaction of ['love', 'eat']) test('own reaction create/change: ' + reaction, async () => {
  const db = client(context({ dinner_drafts: [ok(draft)], draft_candidates: [ok({ id: 'candidate' })], draft_votes: [ok({ id: 'vote' })] }));
  assert.deepEqual(await actions(db).reactToDinnerCandidate('draft', 'candidate', reaction), { success: true });
  assert.deepEqual(db.calls.find(c => c.table === 'draft_votes').methods[0], ['upsert', { candidate_id: 'candidate', family_member_id: 'member', reaction }, { onConflict: 'candidate_id,family_member_id' }]);
});
test('invalid reaction fails without database access', async () => {
  const db = client({}); assert.match((await actions(db).reactToDinnerCandidate('draft', 'candidate', '__proto__')).error, /valid reaction/); assert.equal(db.calls.length, 0);
});
for (const change of [{ status: 'finalised' }, { status: 'cancelled' }, { expires_at: '2000-01-01T00:00:00Z' }, { family_id: 'other' }]) test('reaction rejects closed/foreign draft ' + JSON.stringify(change), async () => {
  const db = client(context({ dinner_drafts: [ok({ ...draft, ...change })] }));
  assert.ok((await actions(db).reactToDinnerCandidate('draft', 'candidate', 'love')).error);
  assert.ok(!db.calls.some(c => c.table === 'draft_votes'));
});
test('cross-family loader rejects without fetching candidate data', async () => {
  const db = client(context({ dinner_drafts: [ok({ ...draft, family_id: 'other' })] }));
  assert.equal(await load('apps/web/src/lib/dinnerDraft.ts', mocks(db)).loadDinnerDraft('draft'), null);
  assert.ok(!db.calls.some(c => c.table === 'draft_candidates'));
});
test('loader scores with authoritative domain, exposes explicit tie and own reaction', async () => {
  const candidates = ['a','b','c'].map(id => ({ id, recipe_snapshot: { title: id }, recipe_id: id }));
  const votes = ['a','b'].map(candidate_id => ({ candidate_id, family_member_id: 'member', reaction: 'love' }));
  const db = client(context({ dinner_drafts: [ok(draft)], draft_candidates: [ok(candidates)], draft_votes: [ok(votes)] }));
  const data = await load('apps/web/src/lib/dinnerDraft.ts', mocks(db)).loadDinnerDraft('draft');
  const shared = load('packages/shared/src/dinnerDraft.ts');
  assert.deepEqual(data.result, shared.scoreDraft(candidates, votes.map(v => ({ candidateId: v.candidate_id, familyMemberId: v.family_member_id, reaction: v.reaction }))));
  assert.equal(data.result.tied, true); assert.equal(data.result.winner, null); assert.equal(data.participants, 1); assert.equal(data.candidates[0].reaction, 'love'); assert.equal(data.canManage, true);
});
test('finalisation refuses a winner that changed since the displayed result', async () => {
  const db = client(context({ dinner_drafts: [ok(draft)], draft_candidates: [ok([{ id: 'new-winner' }, { id: 'old-winner' }])], draft_votes: [ok([{ candidate_id: 'new-winner', family_member_id: 'member', reaction: 'love' }])] }));
  assert.match((await actions(db).finaliseDinnerDraft('draft', 'old-winner')).error, /results changed/);
  assert.ok(!db.calls.some(c => c.rpc === 'finalise_dinner_draft'));
});
test('finalised loader uses persisted scores despite later membership deletion', async () => {
  const persisted = { winner: 'a', scores: [{ candidateId: 'a', score: 3, voteCount: 1, reactions: { love: 1, eat: 0, whatever: 0, nope: 0 } }], voteCount: 1, tied: false, tiedCandidateIds: [] };
  const db = client(context({ dinner_drafts: [ok({ ...draft, status: 'finalised', result: persisted })], draft_candidates: [ok([{ id: 'a', recipe_snapshot: { title: 'Rice' } }])], draft_votes: [ok([])] }));
  const data = await load('apps/web/src/lib/dinnerDraft.ts', mocks(db)).loadDinnerDraft('draft');
  assert.deepEqual(data.result, persisted); assert.equal(data.isOpen, false);
});
test('already finalised flow redirects to its persisted date without recommitting', async () => {
  const db = client(context({ dinner_drafts: [ok({ status: 'finalised', winner_candidate_id: 'a' })], draft_candidates: [ok({ target_date: '2026-09-14' })] }));
  await assert.rejects(actions(db).finishDinnerDraft('draft', 'outdated'), /redirect:\/tonight\?date=2026-09-14/);
  assert.ok(!db.calls.some(c => c.rpc === 'finalise_dinner_draft'));
});
test('ordinary member loader has reactions but no management permission', async () => {
  const db = client(context({ dinner_drafts: [ok({ ...draft, created_by: 'planner' })], draft_candidates: [ok([])] }));
  const data = await load('apps/web/src/lib/dinnerDraft.ts', mocks(db)).loadDinnerDraft('draft');
  assert.equal(data.canManage, false);
});

test('household date stays correct across DST and year/week boundaries', () => {
  for (const instant of ['2026-03-08T06:59:00Z', '2026-03-08T07:01:00Z']) assert.equal(dates.householdToday('America/New_York', new Date(instant)), '2026-03-08');
  for (const instant of ['2026-11-01T05:59:00Z', '2026-11-01T06:01:00Z']) assert.equal(dates.householdToday('America/New_York', new Date(instant)), '2026-11-01');
  assert.equal(dates.householdToday('Africa/Johannesburg', new Date('2026-12-31T22:01:00Z')), '2027-01-01');
  assert.deepEqual(dates.dinnerWeek('2027-01-01'), { weekStart: '2026-12-28', dayOfWeek: 4 });
});
test('weekly draft is not exposed through Tonight draft experience', async () => {
  const db = client(context({ dinner_drafts: [ok({ ...draft, draft_type: 'weekly' })] }));
  assert.equal(await load('apps/web/src/lib/dinnerDraft.ts', mocks(db)).loadDinnerDraft('draft'), null);
});

test('expired finalisation stops before scoring or the commit RPC', async () => {
  const db = client(context({ dinner_drafts: [ok({ ...draft, expires_at: '2000-01-01T00:00:00Z' })] }));
  assert.match((await actions(db).finaliseDinnerDraft('draft', 'a')).error, /expired/);
  assert.ok(!db.calls.some(c => c.rpc === 'finalise_dinner_draft' || c.table === 'draft_candidates'));
});
