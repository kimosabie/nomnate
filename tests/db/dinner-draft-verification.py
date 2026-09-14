"""Run against disposable supabase_db_nomnate-phase2-verify only. No app secrets/remote URLs.
Start a fresh isolated Supabase project with repository migrations before running.
"""
import sys
sys.dont_write_bytecode = True
import concurrent.futures
import importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location('harness', Path(__file__).with_name('retention-verification.py'))
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)
h.BASE[h.BASE.index('supabase_db_nomnate-foundation-verify')] = 'supabase_db_nomnate-phase2-verify'
sql, check, deny, u, q = h.sql, h.check, h.deny, h.u, h.q
for who in [61001,61002,61003]:
    sql(f"insert into auth.users(id,email,aud,role) values({q(u(who))},'draft-{who}@example.invalid','authenticated','authenticated');")
for family, owner in [(61101,61001),(61102,61003)]:
    sql(f"insert into public.families(id,name,created_by,invite_code) values({q(u(family))},'Draft fixture',{q(u(owner))},'UX{family}');",owner)
sql("select public.join_family('UX61101','Second member');",61002)
def recipe(n, family=61101, course='main', instructions='Cook rice.', favourite=False):
    sql(f"insert into public.recipes(id,family_id,title,source,course,instructions,is_favourite) values({q(u(n))},{q(u(family))},'Dinner {n}','manual',{q(course)},{q(instructions)},{str(favourite).lower()});")
    sql(f"insert into public.recipe_ingredients(recipe_id,name,quantity,unit) values({q(u(n))},'Rice',1,'cup');")
recipe(61201, favourite=True)
recipe(61202)
recipe(61204, course='dessert')
recipe(61205, instructions='')
recipe(61206, family=61102)
# Null course with a clear dessert name must not sneak into a thin dinner pool.
recipe(61207)
sql(f"update public.recipes set course=null,title='Chocolate cake' where id={q(u(61207))};")
for role in ['anon','authenticated']:
    check(role+' RPC execute grant', "select has_function_privilege('"+role+"','public.start_dinner_draft(date)','execute');",'t' if role=='authenticated' else 'f')
check('RPC definer and empty search path', "select prosecdef and proconfig @> array['search_path=\"\"'] from pg_proc where oid='public.start_dinner_draft(date)'::regprocedure;",'t')
deny('direct Tonight creation rejected', f"insert into public.dinner_drafts(family_id,created_by) values({q(u(61101))},auth.uid());",61001)
deny('spoofed family creation rejected', f"insert into public.dinner_drafts(family_id,created_by) values({q(u(61102))},auth.uid());",61001)
deny('spoofed creator rejected', f"insert into public.dinner_drafts(family_id,created_by) values({q(u(61101))},{q(u(61002))});",61001)
deny('anonymous creation', "select public.start_dinner_draft('2026-09-14');",role='anon')
deny('missing authentication', "select public.start_dinner_draft('2026-09-14');",contains='Authentication')
deny('fewer than three rejects', "select public.start_dinner_draft('2026-09-14');",61001,contains='at least 3')
check('thin pool leaves no partial draft', f"select count(*) from public.dinner_drafts where family_id={q(u(61101))};",0)
recipe(61203)
# Two independent authenticated transactions must return the same ID.
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    ids = list(pool.map(lambda _: sql("select public.start_dinner_draft('2026-09-14');",61001),range(2)))
assert ids[0] == ids[1], ids
draft = ids[0]
print('PASS concurrent duplicate start resumes same draft')
check('exactly three distinct eligible recipes', f"select count(*)||':'||count(distinct recipe_id) from public.draft_candidates where draft_id={q(draft)};",'3:3',61001)
check('date/course/library and snapshot persisted', f"select count(*) from public.draft_candidates where draft_id={q(draft)} and target_date='2026-09-14' and course='main' and nomination_source='library' and recipe_snapshot->>'instructions'='Cook rice.';",3,61001)
check('favourite comes first', f"select recipe_id from public.draft_candidates where draft_id={q(draft)} order by display_order limit 1;",u(61201),61001)
check('cross-family draft invisible', f"select count(*) from public.dinner_drafts where id={q(draft)};",0,61003)
check('cross-family candidates invisible', f"select count(*) from public.draft_candidates where draft_id={q(draft)};",0,61003)
a,b,c = sql(f"select id from public.draft_candidates where draft_id={q(draft)} order by display_order;",61001).splitlines()
deny('cannot append a fourth Tonight candidate',f"insert into public.draft_candidates(draft_id,recipe_id,target_date,course,display_order) values({q(draft)},{q(u(61207))},'2026-09-14','main',3);",61001)
check('cannot remove a Tonight candidate',f"with changed as (delete from public.draft_candidates where id={q(a)} returning id) select count(*) from changed;",0,61001)
check('cannot change Tonight target date',f"with changed as (update public.draft_candidates set target_date='2026-09-19' where id={q(a)} returning id) select count(*) from changed;",0,61001)
def react(candidate, reaction, who=61002):
    return f"insert into public.draft_votes(candidate_id,family_member_id,reaction) values({q(candidate)},(select id from public.family_members where user_id=auth.uid()),{q(reaction)}) on conflict(candidate_id,family_member_id) do update set reaction=excluded.reaction;"
deny('foreign member cannot react', react(a,'love',61003),61003)
deny('invalid reaction rejected', react(a,'invalid'),61002)
deny('cannot vote as another member',f"insert into public.draft_votes(candidate_id,family_member_id,reaction) values({q(a)},(select id from public.family_members where user_id={q(u(61001))}),'love');",61002)
sql(react(a,'eat'),61002)
sql(react(a,'love'),61002)
check('own reaction replaces prior value',f"select count(*)||':'||min(reaction) from public.draft_votes where candidate_id={q(a)};",'1:love',61002)
sql(react(b,'love'),61002)
deny('explicit tie cannot finalise',f"select public.finalise_dinner_draft({q(draft)},{q(a)});",61001,contains='tie')
sql(react(b,'whatever'),61002)
deny('ordinary member cannot finalise',f"select public.finalise_dinner_draft({q(draft)},{q(a)});",61002,contains='Only planner')
deny('foreign family cannot finalise',f"select public.finalise_dinner_draft({q(draft)},{q(a)});",61003,contains='outside active')
deny('stale winner rejected',f"select public.finalise_dinner_draft({q(draft)},{q(b)});",61001,contains='results changed')
sql(f"select public.finalise_dinner_draft({q(draft)},{q(a)});",61001)
check('correct meal committed',f"select recipe_id||':'||status from public.meal_plan_slots where committed_draft_id={q(draft)};",u(61201)+':confirmed',61001)
check('persisted authoritative score',f"select result->'scores' @> jsonb_build_array(jsonb_build_object('candidateId',{q(a)},'score',3)) from public.dinner_drafts where id={q(draft)};",'t',61001)
deny('finalised reaction rejected',react(a,'nope'),61002,contains='outside open')
deny('already finalised rejected',f"select public.finalise_dinner_draft({q(draft)},{q(a)});",61001,contains='not open')
deny('committed date rejects new start',"select public.start_dinner_draft('2026-09-14');",61001,contains='already committed')
for date, closed in [('2026-09-15','cancelled'),('2026-09-16','expired')]:
    d=sql(f"select public.start_dinner_draft('{date}');",61001)
    candidate=sql(f"select id from public.draft_candidates where draft_id={q(d)} limit 1;",61001)
    if closed == 'cancelled': sql(f"select public.cancel_dinner_draft({q(d)});",61001)
    else:
        sql(react(candidate,'love'),61002)
        sql(f"update public.dinner_drafts set expires_at=now()-interval '1 second' where id={q(d)};")
        deny('expired draft cannot finalise through RPC',f"select public.finalise_dinner_draft({q(d)},{q(candidate)});",61001,contains='expired')
        check('expired finalisation rolls back commitment',f"select count(*) from public.meal_plan_slots where committed_draft_id={q(d)};",0)
        check('expired finalisation leaves draft untouched',f"select status from public.dinner_drafts where id={q(d)};",'open')
    deny(closed+' reaction rejected',react(candidate,'love'),61002,contains='outside open')
# Competing commitment after the draft was started remains protected by Phase 1.
d=sql("select public.start_dinner_draft('2026-09-17');",61001)
candidate=sql(f"select id from public.draft_candidates where draft_id={q(d)} limit 1;",61001)
sql(react(candidate,'love'),61002)
sql(f"insert into public.meal_plan_slots(meal_plan_id,day_of_week,course,option_number,recipe_id,status) select id,3,'main',1,{q(u(61202))},'confirmed' from public.meal_plans where family_id={q(u(61101))} and week_start_date='2026-09-14';")
deny('competing commitment rejected',f"select public.finalise_dinner_draft({q(d)},{q(candidate)});",61001,contains='already committed')
# Three unused meals must rotate ahead of the previously nominated trio.
for n in [61211,61212,61213]: recipe(n)
rotated=sql("select public.start_dinner_draft('2026-09-18');",61002)
check('ordinary member creates own draft',f"select created_by from public.dinner_drafts where id={q(rotated)};",u(61002),61002)
check('selection rotates to unused meals',f"select count(*) from public.draft_candidates where draft_id={q(rotated)} and recipe_id in ({q(u(61211))},{q(u(61212))},{q(u(61213))});",3,61002)
check('retries keep the same rotated draft',"select public.start_dinner_draft('2026-09-18');",rotated,61002)
rc=sql(f"select id from public.draft_candidates where draft_id={q(rotated)} order by display_order limit 1;",61002)
sql(react(rc,'love'),61002)
sql(f"select public.finalise_dinner_draft({q(rotated)},{q(rc)});",61001)
check('non-creator admin finalises',f"select status from public.dinner_drafts where id={q(rotated)};",'finalised',61002)
# Shared recipes are eligible only after the active family saves them.
for n in [61221,61222]:
    recipe(n,family=61102)
    sql(f"update public.recipes set family_id=null,is_global=true where id={q(u(n))};")
sql(f"insert into public.family_recipes(family_id,recipe_id,added_by) values({q(u(61102))},{q(u(61221))},{q(u(61003))});",61003)
deny('unsaved shared recipe does not fill the pool',"select public.start_dinner_draft('2026-09-19');",61003,contains='at least 3')
sql(f"insert into public.family_recipes(family_id,recipe_id,added_by) values({q(u(61102))},{q(u(61222))},{q(u(61003))});",61003)
shared=sql("select public.start_dinner_draft('2026-09-19');",61003)
check('saved shared recipes are eligible',f"select count(*) from public.draft_candidates where draft_id={q(shared)} and recipe_id in ({q(u(61221))},{q(u(61222))});",2,61003)
check('RPC argument/return types match Supabase declaration',"select pg_get_function_arguments(oid)||':'||prorettype::regtype from pg_proc where oid='public.start_dinner_draft(date)'::regprocedure;",'dinner_date date:uuid')
print('DINNER DRAFT DB CHECKS PASSED:', h.checks, '+ concurrent start')
