// Generates square app/toolbar icons from the wide logo by cropping the flock
// mark (dropping the wordmark) and padding to a square with the logo's own
// background. Re-run after the logo changes:  node scripts/make-icons.mjs
// (Tune CROP if the artwork's composition changes.)
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const SRC = 'assets/logo.png'

// Region of the logo containing the flock mark (logo is 2816x1536; the wordmark
// is in the lower portion and is excluded).
const CROP = { left: 250, top: 110, width: 2320, height: 880 }

const sizes = [
  { file: 'build/icon.png', size: 1024 }, // electron-builder source icon (packaged app)
  { file: 'resources/icon.png', size: 512 }, // bundled BrowserWindow icon (dev + Linux taskbar)
  { file: 'assets/icon.png', size: 512 }, // README / general use
  { file: 'assets/icon-32.png', size: 32 } // small / toolbar size
]

const run = async () => {
  // Sample the logo background (top-left) so the square padding is seamless.
  const corner = await sharp(SRC).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer()
  const bg = { r: corner[0], g: corner[1], b: corner[2], alpha: 1 }

  const mark = await sharp(SRC).extract(CROP).png().toBuffer()

  for (const { file, size } of sizes) {
    mkdirSync(dirname(file), { recursive: true })
    await sharp(mark)
      .resize(size, size, { fit: 'contain', background: bg })
      .png()
      .toFile(file)
    console.log(`wrote ${file} (${size}x${size})`)
  }
  console.log('background:', bg)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
