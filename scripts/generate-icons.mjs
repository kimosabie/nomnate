/**
 * NomNate PWA icon generator
 * Uses sharp (already in the monorepo) to render SVG → PNG at each target size.
 * Run from the repo root: node scripts/generate-icons.mjs
 */

import { createRequire } from 'module'
import { writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// Load sharp from pnpm store (it's a dev dep of the web app)
const sharpPaths = [
  resolve(__dirname, '../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp'),
  resolve(__dirname, '../apps/web/node_modules/sharp'),
  resolve(__dirname, '../node_modules/sharp'),
]
let sharp
for (const p of sharpPaths) {
  try { sharp = require(p); break } catch { /* try next */ }
}
if (!sharp) throw new Error('Could not find sharp. Run: pnpm install')

const outDir = resolve(__dirname, '../apps/web/public/icons')
mkdirSync(outDir, { recursive: true })

/**
 * Build the SVG for a given icon size.
 * All values are proportional so it renders crisply at every size.
 */
function buildSVG(size) {
  const r = Math.round(size * 0.18)           // corner radius
  const cx = size / 2
  const fontSize = Math.round(size * 0.32)
  const nomY = Math.round(size * 0.40)
  const nateY = Math.round(size * 0.72)
  const lineY = Math.round(size * 0.54)
  const lineX = Math.round(size * 0.18)
  const lineW = Math.round(size * 0.64)
  const lineH = Math.max(1, Math.round(size * 0.022))

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <!-- Background — full square; iOS/Android clips corners itself -->
  <rect width="${size}" height="${size}" fill="#E8621A"/>
  <!-- Subtle inner glow -->
  <rect
    x="${Math.round(size * 0.07)}" y="${Math.round(size * 0.07)}"
    width="${Math.round(size * 0.86)}" height="${Math.round(size * 0.86)}"
    rx="${Math.round(r * 0.8)}" ry="${Math.round(r * 0.8)}"
    fill="rgba(255,122,53,0.22)"
  />
  <!-- "Nom" -->
  <text
    x="${cx}" y="${nomY}"
    text-anchor="middle" dominant-baseline="auto"
    font-family="Fredoka, Arial Rounded MT Bold, Helvetica Neue, Arial, sans-serif"
    font-weight="700"
    font-size="${fontSize}"
    fill="white"
    letter-spacing="-0.5"
  >Nom</text>
  <!-- Divider -->
  <rect x="${lineX}" y="${lineY}" width="${lineW}" height="${lineH}" rx="1" fill="rgba(255,255,255,0.38)"/>
  <!-- "Nate" -->
  <text
    x="${cx}" y="${nateY}"
    text-anchor="middle" dominant-baseline="auto"
    font-family="Fredoka, Arial Rounded MT Bold, Helvetica Neue, Arial, sans-serif"
    font-weight="600"
    font-size="${fontSize}"
    fill="rgba(255,255,255,0.90)"
    letter-spacing="-0.5"
  >Nate</text>
</svg>`
}

const SIZES = [
  { size: 16,  name: 'favicon-16' },
  { size: 32,  name: 'favicon-32' },
  { size: 48,  name: 'icon-48' },
  { size: 96,  name: 'icon-96' },
  { size: 180, name: 'apple-touch-icon' },
  { size: 192, name: 'icon-192' },
  { size: 512, name: 'icon-512' },
]

for (const { size, name } of SIZES) {
  const svg = buildSVG(size)
  const outPath = resolve(outDir, `${name}.png`)
  await sharp(Buffer.from(svg))
    .flatten({ background: '#E8621A' })
    .png({ compressionLevel: 9 })
    .toFile(outPath)
  console.log(`  ✓ ${name}.png (${size}×${size})`)
}

// favicon.ico — plain PNG works universally in modern browsers
const faviconBuf = await sharp(Buffer.from(buildSVG(32)))
  .flatten({ background: '#E8621A' })
  .png()
  .toBuffer()
writeFileSync(resolve(__dirname, '../apps/web/public/favicon.ico'), faviconBuf)
console.log('  ✓ favicon.ico')

console.log('\nAll icons generated successfully.')
