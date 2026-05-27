// Generates square app/toolbar icons from the transparent flock source. The
// source (assets/icon-source.png) is the flock on a real alpha channel; we trim
// any transparent margin and pad to a square keeping transparency.
// Re-run after the source changes:  node scripts/make-icons.mjs
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const SRC = 'assets/icon-source.png'

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }

const sizes = [
  { file: 'build/icon.png', size: 1024 }, // electron-builder source icon (packaged app)
  { file: 'resources/icon.png', size: 512 }, // bundled BrowserWindow icon (dev + Linux taskbar)
  { file: 'assets/icon.png', size: 512 }, // README / general use
  { file: 'assets/icon-32.png', size: 32 } // small / toolbar size
]

const run = async () => {
  const mark = await sharp(SRC).trim().png().toBuffer()
  for (const { file, size } of sizes) {
    mkdirSync(dirname(file), { recursive: true })
    await sharp(mark)
      .resize(size, size, { fit: 'contain', background: TRANSPARENT })
      .png()
      .toFile(file)
    console.log(`wrote ${file} (${size}x${size})`)
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
