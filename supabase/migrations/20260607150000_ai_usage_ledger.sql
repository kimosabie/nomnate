-- =====================================================================
-- Migration: AI usage ledger (B15.1)
-- =====================================================================
-- Counts AI operations per family per week so a "plan my whole week" can cost a
-- single use regardless of how many dishes it generates. Replaces the previous
-- approach of counting AI recipes added to family_recipes.
--
-- kind: 'slot' (per-slot suggestion) | 'week_plan' (whole-week generation)
--
-- Apply: supabase db push
-- =====================================================================

create table if not exists public.ai_usage (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  kind        text not null default 'slot' check (kind in ('slot', 'week_plan')),
  created_at  timestamptz not null default now()
);

create index if not exists ai_usage_family_created_idx on public.ai_usage (family_id, created_at);

alter table public.ai_usage enable row level security;

create policy "Family members view ai usage"
  on public.ai_usage for select
  using (
    exists (
      select 1 from public.family_members
      where family_members.family_id = ai_usage.family_id
        and family_members.user_id = auth.uid()
    )
  );

create policy "Family members log ai usage"
  on public.ai_usage for insert
  with check (
    exists (
      select 1 from public.family_members
      where family_members.family_id = ai_usage.family_id
        and family_members.user_id = auth.uid()
    )
  );

comment on table public.ai_usage is
  'Per-family AI operation ledger (B15). getAIUsageThisWeek counts rows since week start; FREE_AI_LIMIT caps it. A week-plan logs one row.';
