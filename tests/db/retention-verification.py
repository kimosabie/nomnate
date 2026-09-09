"""Synthetic regression fixtures for the disposable nomnate-foundation-verify DB.
Run `seed` on pre-fix or fresh schema, then `verify` after applying the fix.
Requires local Docker; never reads application env files or remote DB URLs.
The per-session supautils workaround is explained in NOMNATE-2-FOUNDATION.md.
"""
import subprocess
import sys
import uuid

BASE = ['docker', '-H', 'unix:///var/run/docker.sock', 'exec', '-i',
        '-e', 'PGOPTIONS=-c session_preload_libraries=',
        'supabase_db_nomnate-foundation-verify', 'sh', '-c',
        'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql -X -qAt -v ON_ERROR_STOP=1 -U supabase_admin -d postgres']
checks = 0

def u(n): return str(uuid.UUID(int=n))
def q(value): return "'" + str(value).replace("'", "''") + "'"
def run(statement, user=None, role=None):
    role = role or ('authenticated' if user else 'postgres')
    assert role in ('postgres', 'authenticated', 'anon')
    prefix = 'begin;\n'
    if role != 'postgres': prefix += f'set local role {role};\n'
    if user: prefix += f'set local request.jwt.claim.sub={q(u(user))};\n'
    return subprocess.run(BASE, input=prefix+statement+'\ncommit;', text=True, capture_output=True)
def sql(statement, user=None, role=None):
    result = run(statement, user, role)
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()
def check(label, statement, expected, user=None, role=None):
    global checks
    actual = sql(statement, user, role)
    assert actual == str(expected), (label, actual, expected)
    checks += 1
    print('PASS', label, flush=True)
def deny(label, statement, user=None, role=None, contains=None):
    global checks
    result = run(statement, user, role)
    assert result.returncode != 0, (label, result.stdout)
    if contains: assert contains.lower() in result.stderr.lower(), result.stderr
    checks += 1
    print('PASS', label, flush=True)

def seed():
    for n in range(50001, 50007):
        sql(f"insert into auth.users(id,email,aud,role) values({q(u(n))},'remediation-{n}@example.invalid','authenticated','authenticated');")
    for f, owner in [(50101,50001),(50102,50004),(50103,50006)]:
        sql(f"insert into public.families(id,name,created_by,invite_code) values({q(u(f))},'Retention fixture',{q(u(owner))},'RET{f}');", owner)
    for who, f in [(50002,50101),(50003,50101),(50005,50102)]:
        sql(f"select public.join_family('RET{f}','Synthetic member');", who)
    sql(f"update public.family_members set role='admin' where user_id={q(u(50002))};",50001)
    for n, status in [(50201,'open'),(50202,'cancelled'),(50203,'finalised'),(50204,'cancelled')]:
        author = 50002 if n == 50204 else 50001
        sql(f"insert into public.recipes(id,family_id,created_by,title,source,is_global,prep_time) values({q(u(n))},{q(u(50101))},{q(u(author))},'Retention recipe {n}','manual',false,20);",author)
        sql(f"insert into public.recipe_ingredients(recipe_id,name,quantity,unit) values({q(u(n))},'Rice',0.25,'cup');",author)
        sql(f"insert into public.dinner_drafts(id,family_id,created_by) values({q(u(n+100))},{q(u(50101))},{q(u(50001))});",50001)
        date = "'2026-09-09'" if status == 'finalised' else 'null'
        sql(f"insert into public.draft_candidates(id,draft_id,recipe_id,target_date) values({q(u(n+200))},{q(u(n+100))},{q(u(n))},{date});",50001)
        for who in [50001,50002]:
            sql(f"insert into public.draft_votes(candidate_id,family_member_id,reaction) values({q(u(n+200))},(select id from public.family_members where user_id=auth.uid()),'love');",who)
        if status == 'cancelled': sql(f"select public.cancel_dinner_draft({q(u(n+100))});",50001)
        if status == 'finalised': sql(f"select public.finalise_dinner_draft({q(u(n+100))},{q(u(n+200))});",50001)
    sql(f"insert into public.family_recipes(family_id,recipe_id,added_by) values({q(u(50101))},{q(u(50201))},{q(u(50001))});")
    # A sole-owner family with a finalised commitment must also cascade safely.
    sql(f"insert into public.recipes(id,family_id,created_by,title,source) values({q(u(50206))},{q(u(50103))},{q(u(50006))},'Sole recipe','manual');",50006)
    sql(f"insert into public.dinner_drafts(id,family_id,created_by) values({q(u(50306))},{q(u(50103))},{q(u(50006))});",50006)
    sql(f"insert into public.draft_candidates(id,draft_id,recipe_id,target_date) values({q(u(50406))},{q(u(50306))},{q(u(50206))},'2026-09-09');",50006)
    sql(f"insert into public.draft_votes(candidate_id,family_member_id,reaction) values({q(u(50406))},(select id from public.family_members where user_id=auth.uid()),'love');",50006)
    sql(f"select public.finalise_dinner_draft({q(u(50306))},{q(u(50406))});",50006)
    print('SEED COMPLETE', flush=True)

def verify():
    # The new migration must not replace policies or relax existing grants.
    for t in ['dinner_drafts','draft_candidates','draft_votes']:
        check(t+' RLS', f"select relrowsecurity from pg_class where oid='public.{t}'::regclass;",'t')
    for name in ['finalise_dinner_draft(uuid,uuid)','cancel_dinner_draft(uuid)','join_family(text,text)']:
        check(name+' authenticated grant', f"select has_function_privilege('authenticated','public.{name}','execute');",'t')
        check(name+' anon denied', f"select has_function_privilege('anon','public.{name}','execute');",'f')
    for role in ['anon','authenticated']:
        check('succession trigger is not RPC for '+role, f"select has_function_privilege('{role}','public.succeed_deleted_family_owner()','execute');",'f')
    check('creator FK nullable',"select is_nullable from information_schema.columns where table_schema='public' and table_name='dinner_drafts' and column_name='created_by';",'YES')
    for field in ['prep_time','cook_time','servings','calories_per_serving','protein_g','carbs_g','fat_g']:
        check('actual recipe type '+field, f"select data_type from information_schema.columns where table_schema='public' and table_name='recipes' and column_name='{field}';",'integer')
    check('ingredient type remains numeric',"select data_type from information_schema.columns where table_schema='public' and table_name='recipe_ingredients' and column_name='quantity';",'numeric')
    check('all existing candidates snapshotted', "select count(*) from public.draft_candidates where draft_id between " + q(u(50301)) + ' and ' + q(u(50304)) + " and recipe_snapshot->>'title' like 'Retention recipe %' and recipe_snapshot->'ingredients'->0->>'quantity'='0.25';",4)
    deny('open recipe deletion protected',f"delete from public.recipes where id={q(u(50201))};",50001)
    deny('finalised recipe deletion protected',f"delete from public.recipes where id={q(u(50203))};",50001)
    deny('cancelled candidate cannot be detached directly',f"update public.draft_candidates set recipe_id=null where id={q(u(50404))};",contains='outside editable')
    before = sql(f"select recipe_snapshot::text from public.draft_candidates where id={q(u(50404))};")
    sql(f"update public.recipes set title='Changed after snapshot' where id={q(u(50204))};",50002)
    sql(f"delete from public.recipes where id={q(u(50204))};",50002)
    check('cancelled manual recipe deleted',f"select count(*) from public.recipes where id={q(u(50204))};",0)
    check('cancelled candidate reference cleared',f"select recipe_id is null from public.draft_candidates where id={q(u(50404))};",'t',50002)
    check('cancelled snapshot preserved exactly',f"select recipe_snapshot::text from public.draft_candidates where id={q(u(50404))};",before,50002)
    check('cancelled reactions retained',f"select count(*) from public.draft_votes where candidate_id={q(u(50404))};",2,50002)
    deny('closed snapshot immutable',f"update public.draft_candidates set recipe_snapshot='{{}}' where id={q(u(50404))};",contains='outside editable')
    # Force a failure after BEFORE DELETE succession. PostgreSQL must undo owner and role updates.
    sql('create table public.retention_test_blocker(user_id uuid references auth.users(id));' +
        f'insert into public.retention_test_blocker values({q(u(50004))});')
    deny('failed auth SQL deletion rolls back succession',f"delete from auth.users where id={q(u(50004))};",contains='foreign key')
    check('failed deletion retains auth user',f"select count(*) from auth.users where id={q(u(50004))};",1)
    check('failed deletion retains original owner',f"select created_by from public.families where id={q(u(50102))};",u(50004))
    check('failed deletion rolls back successor promotion',f"select role from public.family_members where user_id={q(u(50005))};",'member')
    sql('drop table public.retention_test_blocker;')
    sql(f"delete from auth.users where id={q(u(50004))};")
    check('ordinary successor becomes owner',f"select created_by from public.families where id={q(u(50102))};",u(50005))
    check('ordinary successor becomes admin',f"select role from public.family_members where user_id={q(u(50005))};",'admin')
    final_before = sql(f"select result::text from public.dinner_drafts where id={q(u(50303))};")
    sql(f"delete from auth.users where id={q(u(50001))};")
    check('draft creator account removed',f"select count(*) from auth.users where id={q(u(50001))};",0)
    check('family survives with existing admin owner',f"select created_by from public.families where id={q(u(50101))};",u(50002),50002)
    for n,status in [(50301,'open'),(50302,'cancelled'),(50303,'finalised')]:
        check(status+' draft retains family with null creator',f"select status||':'||(created_by is null)::text||':'||family_id from public.dinner_drafts where id={q(u(n))};",status+':true:'+u(50101),50002)
        check(status+' creator reaction cascades, other reaction survives',f"select count(*) from public.draft_votes where candidate_id={q(u(n+100))};",1,50002)
    check('recipe audit identity anonymised',f"select created_by is null from public.recipes where id={q(u(50201))};",'t')
    check('library audit identity anonymised',f"select added_by is null from public.family_recipes where recipe_id={q(u(50201))};",'t')
    check('finalised result unchanged',f"select result::text from public.dinner_drafts where id={q(u(50303))};",final_before,50002)
    check('finalised commitment intact',f"select recipe_id from public.meal_plan_slots where committed_draft_id={q(u(50303))};",u(50203),50002)
    deny('null creator cannot bypass finalisation authorization',f"select public.finalise_dinner_draft({q(u(50301))},{q(u(50401))});",50003,contains='Only planner')
    check('ordinary member cannot edit null-creator draft',f"select public.can_edit_draft({q(u(50301))});",'f',50003)
    deny('ordinary member cannot self-promote',"update public.family_members set role='admin' where user_id=auth.uid();",50003,contains='Only family admins')
    sql(f"select public.finalise_dinner_draft({q(u(50301))},{q(u(50401))});",50002)
    check('remaining admin finalises null-creator draft',f"select status from public.dinner_drafts where id={q(u(50301))};",'finalised',50002)
    check('cross-family draft isolation remains',f"select count(*) from public.dinner_drafts where family_id={q(u(50101))};",0,50005)
    sql(f"delete from auth.users where id={q(u(50006))};")
    check('sole-owner family still cascades',f"select count(*) from public.families where id={q(u(50103))};",0)
    for table in ['dinner_drafts', 'draft_candidates', 'draft_votes', 'meal_plan_slots']:
        predicate = f"id={q(u(50306))}" if table == 'dinner_drafts' else f"draft_id={q(u(50306))}" if table == 'draft_candidates' else f"candidate_id={q(u(50406))}" if table == 'draft_votes' else f"committed_draft_id={q(u(50306))}"
        check('sole-owner cascade removes '+table, f"select count(*) from public.{table} where {predicate};",0)
    print('RETENTION CHECKS PASSED:', checks)

if __name__ == '__main__':
    assert len(sys.argv) == 2 and sys.argv[1] in ('seed','verify')
    {'seed':seed,'verify':verify}[sys.argv[1]]()
