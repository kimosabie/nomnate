// One-off backfill for B7.1: estimate nutrition for recipes that have none.
// Spoonacular guessNutrition (by title) first; Claude (Haiku) fallback. Marks
// filled rows nutrition_estimated=true. Idempotent — only rows with null calories.
//
//   node --env-file=apps/web/.env.local scripts/backfill-recipe-nutrition.mjs [--dry] [--limit=N]
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../apps/web/.env.local') })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const SPOON = process.env.SPOONACULAR_API_KEY
const DRY = process.argv.includes('--dry')
const limitArg = process.argv.find((a) => a.startsWith('--limit='))
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : 1000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const intOrNull = (v) => (typeof v === 'number' ? Math.round(v) : null)

async function spoonGuess(title) {
  if (!SPOON || !title) return null
  try {
    const u = new URL('https://api.spoonacular.com/recipes/guessNutrition')
    u.searchParams.set('apiKey', SPOON)
    u.searchParams.set('title', title)
    const res = await fetch(u)
    if (!res.ok) return null
    const d = await res.json()
    const cal = d?.calories?.value
    if (typeof cal !== 'number') return null
    return { calories_per_serving: Math.round(cal), protein_g: intOrNull(d.protein?.value), carbs_g: intOrNull(d.carbs?.value), fat_g: intOrNull(d.fat?.value) }
  } catch { return null }
}

async function aiGuess(title, ingredients) {
  const ing = ingredients.length ? `\nIngredients: ${ingredients.join(', ')}.` : ''
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{ role: 'user', content: `Estimate per-serving nutrition. Reply ONLY compact JSON {"calories":N,"protein_g":N,"carbs_g":N,"fat_g":N} integers.\nDish: ${title}.${ing}` }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const j = JSON.parse(text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, ''))
    if (typeof j.calories !== 'number') return null
    return { calories_per_serving: Math.round(j.calories), protein_g: intOrNull(j.protein_g), carbs_g: intOrNull(j.carbs_g), fat_g: intOrNull(j.fat_g) }
  } catch { return null }
}

const { data: recipes, error } = await sb
  .from('recipes')
  .select('id, title')
  .is('calories_per_serving', null)
  .limit(LIMIT)
if (error) { console.error('Query failed:', error.message); process.exit(1) }
console.log(`${recipes.length} recipe(s) without nutrition`)

let spoon = 0, ai = 0, none = 0
for (const r of recipes) {
  const ings = (await sb.from('recipe_ingredients').select('name').eq('recipe_id', r.id)).data ?? []
  const names = ings.map((i) => i.name)
  let n = await spoonGuess(r.title)
  if (n) spoon++
  else { n = await aiGuess(r.title, names); if (n) ai++ }
  if (!n) { none++; console.log('  (none)', JSON.stringify(r.title)); continue }
  if (DRY) console.log(`  ${String(n.calories_per_serving).padStart(4)} kcal  ${JSON.stringify(r.title)}`)
  else {
    const { error: e } = await sb.from('recipes').update({ ...n, nutrition_estimated: true }).eq('id', r.id)
    if (e) console.error('  update failed', r.id, e.message)
  }
  await sleep(250) // be gentle on the APIs
}
console.log(DRY ? 'DRY RUN — no writes.' : 'Done.', JSON.stringify({ spoon, ai, none }))
