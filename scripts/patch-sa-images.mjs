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

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY

const FALLBACKS = {
  'Potjiekos': 'south african stew cast iron pot',
  'Hearty Vegetable and Beef Soup with Bread': 'beef vegetable soup rustic bread',
  'Chicken Livers Peri-Peri': 'chicken livers spicy pan fried',
  'Lamb Bunny Chow': 'lamb curry bread bowl',
  'Vetkoek with Mince': 'fried dough bread stuffed mince',
  'Creamy Biltong Pasta': 'creamy pasta beef south african',
  'Durban Lamb Curry': 'lamb curry spicy durban bowl',
  'Creamy Biltong Pasta': 'creamy beef pasta dish',
}

async function fetchImage(title) {
  const queries = [
    FALLBACKS[title],
    `${title} south african food`,
    `${title} food dish`,
    title,
  ].filter(Boolean)

  for (const query of queries) {
    try {
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&client_id=${UNSPLASH_KEY}`
      const res = await fetch(url)
      const data = await res.json()
      const image = data.results?.[0]?.urls?.regular
      if (image) {
        console.log(`  → matched: "${query}"`)
        return image
      }
    } catch (e) {
      console.error(`  → error fetching "${query}":`, e.message)
    }
    await new Promise(r => setTimeout(r, 600))
  }
  return null
}

const { data: recipes, error } = await supabase
  .from('recipes')
  .select('id, title')
  .eq('cuisine', 'South African')
  .is('image_url', null)

if (error) {
  console.error('Supabase error:', error)
  process.exit(1)
}

console.log(`Found ${recipes.length} SA recipes missing images\n`)

for (const recipe of recipes) {
  console.log(`Processing: ${recipe.title}`)
  const imageUrl = await fetchImage(recipe.title)
  if (imageUrl) {
    await supabase
      .from('recipes')
      .update({ image_url: imageUrl })
      .eq('id', recipe.id)
    console.log(`✓ Done\n`)
  } else {
    console.log(`✗ No image found — skipping\n`)
  }
  await new Promise(r => setTimeout(r, 1000))
}

console.log('All done!')
