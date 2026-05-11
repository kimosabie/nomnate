-- Add themealdb_id for dedup and expand source constraint
alter table recipes
  add column if not exists themealdb_id text;

alter table recipes
  drop constraint if exists recipes_source_check;

alter table recipes
  add constraint recipes_source_check
    check (source in ('ai', 'spoonacular', 'manual', 'themealdb', 'prescribed'));
