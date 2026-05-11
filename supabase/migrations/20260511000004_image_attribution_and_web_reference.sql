-- Add image attribution for Unsplash credits
alter table recipes
  add column if not exists image_attribution text;

-- Expand source constraint: add web_reference for real SA recipes sourced from websites
alter table recipes
  drop constraint if exists recipes_source_check;

alter table recipes
  add constraint recipes_source_check
    check (source in ('ai', 'spoonacular', 'manual', 'themealdb', 'prescribed', 'web_reference'));
