-- =====================================================================
-- Migration: Add localisation fields to families
-- =====================================================================
-- Adds country, timezone, cuisine preferences, and dietary requirements
-- to support the expat pilot (ZA, GB, FR, AU, AE).
--
-- Run this against your Supabase project (SQL Editor or via CLI):
--   supabase migration new add_localisation_to_families
--   (paste this content, then `supabase db push`)
-- =====================================================================

-- 1. Add the new columns (nullable + defaults so existing rows survive)
alter table public.families
  add column if not exists country text,
  add column if not exists timezone text,
  add column if not exists cuisine_preferences text[] not null default '{}'::text[],
  add column if not exists dietary_requirements text[] not null default '{}'::text[];

-- 2. Constrain country to the codes we currently support.
--    To add a new country later: drop the constraint, add it back with the
--    new code, and add a matching entry in packages/shared/localisation.ts.
alter table public.families
  drop constraint if exists families_country_check;

-- Normalize legacy 'UK' code to ISO 3166-1 alpha-2 'GB'
update public.families set country = 'GB' where country = 'UK';

alter table public.families
  add constraint families_country_check
  check (country in ('ZA', 'GB', 'FR', 'AU', 'AE'));

-- 3. Backfill existing pilot families.
--    Adjust per-family below if any of them are not in SA.
update public.families
set
  country = coalesce(country, 'ZA'),
  timezone = coalesce(timezone, 'Africa/Johannesburg'),
  cuisine_preferences = case
    when array_length(cuisine_preferences, 1) is null
      then array['south_african']
    else cuisine_preferences
  end
where country is null
   or timezone is null;

-- 4. Now that everyone has values, make country + timezone required.
alter table public.families
  alter column country set not null,
  alter column timezone set not null;

-- 5. Helpful index if you ever segment by country in dashboards.
create index if not exists families_country_idx
  on public.families (country);

-- 6. Comments for future-you
comment on column public.families.country is
  'ISO 3166-1 alpha-2 country code. Drives stores, currency, timezone.';
comment on column public.families.timezone is
  'IANA timezone string, e.g. Africa/Johannesburg, Europe/London.';
comment on column public.families.cuisine_preferences is
  'Array of cuisine slugs from packages/shared/localisation.ts CUISINES.';
comment on column public.families.dietary_requirements is
  'Array of dietary slugs from packages/shared/localisation.ts DIETARY_REQUIREMENTS.';
