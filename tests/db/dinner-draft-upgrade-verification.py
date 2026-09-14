"""Run on the isolated Phase 1 baseline before applying the new migration.
Seeds synthetic retention fixtures, applies Phase 2, and verifies retained data.
"""
import sys
sys.dont_write_bytecode=True
import importlib.util
import subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('h',root/'tests/db/retention-verification.py')
h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
h.BASE[h.BASE.index('supabase_db_nomnate-foundation-verify')]='supabase_db_nomnate-phase2-verify'
h.seed()
# A populated Phase 1 Tonight draft must remain resumable after the policy hardening.
u,q,sql=h.u,h.q,h.sql
sql(f"insert into public.dinner_drafts(id,family_id,created_by) values({q(u(65001))},{q(u(50101))},{q(u(50001))});",50001)
for i,n in enumerate([50201,50202,50203]):
    sql(f"insert into public.draft_candidates(draft_id,recipe_id,target_date,course,display_order) values({q(u(65001))},{q(u(n))},'2026-12-01','main',{i});",50001)
result=subprocess.run(h.BASE,input=(root/'supabase/migrations/20260914000001_start_dinner_draft.sql').read_text(),text=True,capture_output=True)
assert result.returncode==0,result.stderr
h.check('Phase 1 three-candidate draft resumes after upgrade',"select public.start_dinner_draft('2026-12-01');",u(65001),50001)
h.verify()
print('UPGRADE AND PHASE 1 RETENTION VERIFIED')
