-- Add a safe default for timezone so new family registrations don't break.
-- Onboarding only inserts (name, created_by, country); timezone was NOT NULL
-- with no default after the localisation migration, which would cause every
-- new sign-up to fail. The default matches country's existing DEFAULT 'ZA'.
-- Admins can update their timezone via the family settings page once the
-- timezone picker is built.
alter table public.families
  alter column timezone set default 'Africa/Johannesburg';
