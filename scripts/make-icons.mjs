// Generates square app/toolbar icons from the wide logo by cropping just the
// bird mark (dropping the wordmark), keying the cream background to transparent,
// and padding to a square. Re-run after the logo changes:
//   node scripts/make-icons.mjs
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const SRC = 'assets/logo.png'

// Region of the logo containing the bird mark (logo is 2816x1536; the wordmark
// is the lower third, which we exclude). trim() then tightens to the mark.
const CROP = { left: 760, top: 215, width: 1320, height: 680 }

// Color distance from the sampled background treated as "background" → made
// transparent. Higher = removes more (risk of eating light pixels of the mark).
const THRESHOLD = 34

const sizes = [
  { file: 'build/icon.png', size: 1024 }, // electron-builder source icon
  { file: 'assets/icon.png', size: 512 },
  { file: 'assets/icon-32.png', size: 32 } // toolbar size
]

const run = async () => {
  // Sample the logo background (top-left pixel).
  const corner = await sharp(SRC).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer()
  const bg = { r: corner[0], g: corner[1], b: corner[2] }

  // Crop the bird mark and trim the cream margins around it.
  const { data, info } = await sharp(SRC)
    .extract(CROP)
    .trim({ background: { ...bg, alpha: 1 }, threshold: 12 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  // Chroma-key: pixels near the cream background become fully transparent.
  const t2 = THRESHOLD * THRESHOLD
  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - bg.r
    const dg = data[i + 1] - bg.g
    const db = data[i + 2] - bg.b
    if (dr * dr + dg * dg + db * db <= t2) data[i + 3] = 0
  }

  const keyed = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .png()
    .toBuffer()

  mkdirSync('build', { recursive: true })
  for (const { file, size } of sizes) {
    await sharp(keyed)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(file)
    console.log(`wrote ${file} (${size}x${size})`)
  }
  console.log('keyed background:', bg, 'threshold', THRESHOLD)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
