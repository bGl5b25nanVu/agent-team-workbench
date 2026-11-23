// Packages the original Gongzuo brand PNG into the platform icon sizes. The artwork stays
// in docs/design/assets; no second mascot or vector approximation is drawn here.
// sharp is already pinned by the app's attachment runtime in package-lock.json.
// Usage: npm run icon [-- --check] (headless; no Electron display or user profile is needed).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const sharp = createRequire(import.meta.url)('sharp')
const assets = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets')
const artwork = readFileSync(new URL('../../docs/design/assets/gongzuo/brand-mark.png', import.meta.url))
const ICO_SIZES = [16, 20, 24, 32, 36, 40, 48, 64, 72, 96, 128, 256]
// The Linux hicolor set: 1024x1024 is not a registered hicolor directory, so a single large
// PNG installs as an unresolvable icon. electron-builder copies these into hicolor/<size>x<size>/apps/.
const HICOLOR_SIZES = [16, 24, 32, 48, 64, 96, 128, 256, 512]
const TRAY_ICO_SIZES = [16, 20, 24, 32]

// ICO stores PNG entries without flattening their alpha channel.
function icoFile(images) {
  const head = Buffer.alloc(6 + 16 * images.length)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(images.length, 4)
  let offset = head.length
  images.forEach(({ size, png }, index) => {
    const at = 6 + 16 * index
    head.writeUInt8(size >= 256 ? 0 : size, at)
    head.writeUInt8(size >= 256 ? 0 : size, at + 1)
    head.writeUInt16LE(1, at + 4)
    head.writeUInt16LE(32, at + 6)
    head.writeUInt32LE(png.length, at + 8)
    head.writeUInt32LE(offset, at + 12)
    offset += png.length
  })
  return Buffer.concat([head, ...images.map(image => image.png)])
}

const png = (size, template = false) => {
  let render = sharp(artwork).resize(size, size, { fit: 'contain' })
  // macOS paints template images itself. Preserve the source alpha as the template mask.
  if (template) render = render.recomb([[0, 0, 0], [0, 0, 0], [0, 0, 0]])
  return render.png().toBuffer()
}
const check = process.argv.includes('--check')
const stale = []
if (!check) {
  mkdirSync(assets, { recursive: true })
  mkdirSync(join(assets, 'icons'), { recursive: true })
}
const output = (name, value) => {
  const file = join(assets, name)
  if (existsSync(file) && value.equals(readFileSync(file))) return
  stale.push(name)
  if (!check) writeFileSync(file, value)
}
const sizes = [...new Set([1024, 24, ...ICO_SIZES, ...TRAY_ICO_SIZES, ...HICOLOR_SIZES])]
const rendered = new Map(await Promise.all(sizes.map(async size => [size, await png(size)])))
output('icon.png', rendered.get(1024))
output('icon.ico', icoFile(ICO_SIZES.map(size => ({ size, png: rendered.get(size) }))))
output('tray.ico', icoFile(TRAY_ICO_SIZES.map(size => ({ size, png: rendered.get(size) }))))
output('tray.png', rendered.get(24))
output('trayTemplate.png', await png(16, true))
output('trayTemplate@2x.png', await png(32, true))
for (const size of HICOLOR_SIZES) output(join('icons', `${size}x${size}.png`), rendered.get(size))
// The previous generated vector contained the old whale and is no longer a source asset.
if (existsSync(join(assets, 'icon.svg'))) {
  stale.push('icon.svg (obsolete)')
  if (!check) rmSync(join(assets, 'icon.svg'))
}
if (check && stale.length) {
  console.error(`icon: stale assets ${stale.join(', ')}; run npm run icon`)
  process.exitCode = 1
} else console.log(check ? 'icon: all Gongzuo assets are current' : 'icon: packaged Gongzuo PNG, Windows ICO, hicolor PNGs, and platform tray marks')
