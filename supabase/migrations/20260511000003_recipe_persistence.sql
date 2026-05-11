-- Recipe persistence + caching strategy
-- Global recipe library: one row per external recipe, shared across families.
-- family_recipes junction: tracks which families have added each global recipe.

-- 1. Add attribution / caching columns to recipes
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS source_url         text,
  ADD COLUMN IF NOT EXISTS source_attribution text,
  ADD COLUMN IF NOT EXISTS external_id        text,
  ADD COLUMN IF NOT EXISTS is_global          boolean NOT NULL DEFAULT false;

-- 2. Backfill external_id from old per-source columns
UPDATE recipes
  SET external_id = 'spoonacular_' || spoonacular_id::text
  WHERE spoonacular_id IS NOT NULL AND external_id IS NULL;

UPDATE recipes
  SET external_id = 'themealdb_' || themealdb_id
  WHERE themealdb_id IS NOT NULL AND external_id IS NULL;

-- 3. Mark externally-sourced and AI recipes as global
UPDATE recipes SET is_global = true
  WHERE source IN ('spoonacular', 'themealdb', 'ai');

-- 4. Backfill source_attribution
UPDATE recipes
  SET source_attribution = 'Recipe data provided by Spoonacular'
  WHERE source = 'spoonacular' AND source_attribution IS NULL;

UPDATE recipes
  SET source_attribution = 'Recipe from TheMealDB (themealdb.com) — Community contributed'
  WHERE source = 'themealdb' AND source_attribution IS NULL;

UPDATE recipes
  SET source_attribution = 'AI-generated recipe by Claude (Anthropic). Inspired by traditional South African cuisine.'
  WHERE source = 'ai' AND source_attribution IS NULL;

-- 5. family_recipes junction table
CREATE TABLE IF NOT EXISTS family_recipes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   uuid        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  recipe_id   uuid        NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  added_by    uuid        REFERENCES auth.users(id),
  added_at    timestamptz NOT NULL DEFAULT now(),
  is_favourite boolean    NOT NULL DEFAULT false,
  UNIQUE(family_id, recipe_id)
);

ALTER TABLE family_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members view their recipe library"
  ON family_recipes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM family_members
    WHERE family_members.family_id = family_recipes.family_id
      AND family_members.user_id = auth.uid()
  ));

CREATE POLICY "Family members add to their library"
  ON family_recipes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM family_members
    WHERE family_members.family_id = family_recipes.family_id
      AND family_members.user_id = auth.uid()
  ));

CREATE POLICY "Family members update their library"
  ON family_recipes FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM family_members
    WHERE family_members.family_id = family_recipes.family_id
      AND family_members.user_id = auth.uid()
  ));

CREATE POLICY "Family members remove from library"
  ON family_recipes FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM family_members
    WHERE family_members.family_id = family_recipes.family_id
      AND family_members.user_id = auth.uid()
  ));

-- 6. Migrate existing relationships BEFORE clearing family_id
INSERT INTO family_recipes (family_id, recipe_id, added_by, added_at, is_favourite)
SELECT r.family_id, r.id, r.created_by, r.created_at, r.is_favourite
FROM recipes r
WHERE r.is_global = true
  AND r.family_id IS NOT NULL
ON CONFLICT (family_id, recipe_id) DO NOTHING;

-- 7. Clear family_id on global recipes — they now belong to no one family
UPDATE recipes SET family_id = null
  WHERE is_global = true;

-- 8. Unique index on external_id (dedup across families)
CREATE UNIQUE INDEX IF NOT EXISTS recipes_external_id_idx
  ON recipes(external_id)
  WHERE external_id IS NOT NULL;

-- 9. Also add family_recipes to realtime so recipe library updates push live
ALTER PUBLICATION supabase_realtime ADD TABLE family_recipes;
