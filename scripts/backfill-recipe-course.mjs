// One-off backfill for B8.1: classify the `course` of recipes saved before the
// course column existed. Derives from TheMealDB category (stored in `cuisine`
// for mealdb recipes) and a title heuristic; defaults unclassified rows to
// 'main' (the safe common case). Idempotent — only touches rows where course is null.
//
//   node --env-file=apps/web/.env.local scripts/backfill-recipe-course.mjs [--dry]
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../apps/web/.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const DRY = process.argv.includes('--dry')

function courseFromCategory(category) {
  if (!category) return null
  const c = category.toLowerCase().trim()
  if (c === 'dessert') return 'dessert'
  if (c === 'starter') return 'starter'
  if (c === 'side') return 'side'
  if (c === 'breakfast') return null
  // mealdb meat/pasta/seafood/veg categories are mains; cuisines (italian etc.) fall through
  if (['beef', 'chicken', 'lamb', 'pork', 'goat', 'pasta', 'seafood', 'vegetarian', 'vegan', 'miscellaneous'].includes(c)) return 'main'
  return null
}
function courseFromTitle(title) {
  const t = (title ?? '').toLowerCase()
  if (/\b(cake|pudding|tart|pie|ice ?cream|brownie|cookie|cheesecake|malva|koeksister|dessert|trifle|mousse|custard|crumble|doughnut|donut|muffin|cupcake|fudge|baklava)\b/.test(t)) return 'dessert'
  if (/\b(salad|soup|starter|appetiser|appetizer|samoosa|samosa|spring roll|bruschetta|dip|canap)\b/.test(t)) return 'starter'
  return null
}

const { data: recipes, error } = await supabase
  .from('recipes')
  .select('id, title, cuisine, course')
  .is('course', null)

if (error) { console.error('Query failed:', error.message); process.exit(1) }
console.log(`${recipes.length} unclassified recipe(s)`)

const tally = { starter: 0, main: 0, dessert: 0, side: 0 }
for (const r of recipes) {
  const course = courseFromCategory(r.cuisine) ?? courseFromTitle(r.title) ?? 'main'
  tally[course]++
  if (DRY) {
    console.log(`  ${course.padEnd(8)} ← ${JSON.stringify(r.title)}`)
  } else {
    const { error: upErr } = await supabase.from('recipes').update({ course }).eq('id', r.id)
    if (upErr) console.error(`  failed ${r.id}: ${upErr.message}`)
  }
}
console.log(DRY ? 'DRY RUN — no writes.' : 'Done.', JSON.stringify(tally))
