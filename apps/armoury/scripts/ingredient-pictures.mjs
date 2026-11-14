// Cuts the ingredient sprite sheet into the nine pictures the pour picker shows.
//   node scripts/ingredient-pictures.mjs <sheet.png|sheet.jpg>
// Writes public/ingredients/<id>.webp (256 x 256) with cwebp (CWEBP overrides its path), and
// exits non-zero, writing nothing, if the sheet breaks the layout in docs/adr/0112.
/* global console, URL */
import { execFile } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)

export const INGREDIENT_IDS = [
  'emberroot',
  'starpetal',
  'frogfizz',
  'snailshine',
  'bluebell',
  'thundercloud',
  'moonmilk',
  'rosehip',
  'puffcap',
]
export const MIN_SIDE = 1024
export const MAX_BYTES = 30 * 1024
const SQUARE_TOLERANCE = 0.02
const INSET = 0.06
const GRID = 3
const OUT_SIZE = 256
const QUALITY = 85
const CWEBP = process.env.CWEBP ?? '/opt/homebrew/bin/cwebp'
const OUT_DIR = fileURLToPath(new URL('../public/ingredients/', import.meta.url))

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const isFrameMarker = (marker) =>
  marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)

/** The format and size a PNG or JPEG declares in its header, or null for anything else. */
export function readSheetInfo(bytes) {
  if (bytes.length >= 24 && PNG_SIGNATURE.every((b, i) => bytes[i] === b)) {
    return { format: 'png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2
    while (at + 9 < bytes.length && bytes[at] === 0xff) {
      const marker = bytes[at + 1]
      if (isFrameMarker(marker)) {
        return {
          format: 'jpeg',
          width: bytes.readUInt16BE(at + 7),
          height: bytes.readUInt16BE(at + 5),
        }
      }
      at += 2 + bytes.readUInt16BE(at + 2)
    }
  }
  return null
}

/** Why the sheet cannot be cut, or null when it can. */
export function checkSheet(info) {
  if (!info) return 'the sheet must be a PNG or JPEG file'
  const size = `${info.width} x ${info.height}`
  const shortSide = Math.min(info.width, info.height)
  if (shortSide < MIN_SIDE)
    return `the sheet is too small (${size}); it must be at least ${MIN_SIDE} px a side`
  if (Math.abs(info.width - info.height) / shortSide > SQUARE_TOLERANCE) {
    return `the sheet is not square (${size}); its sides may differ by at most 2 percent`
  }
  return null
}

/** The nine crops in wheel order, each cell of the 3 x 3 grid inset by 6 percent, centred on a square sheet. */
export function cropRects({ width, height }) {
  const side = Math.min(width, height)
  const cell = side / GRID
  const inset = cell * INSET
  const size = Math.round(cell - 2 * inset)
  const left = (width - side) / 2
  const top = (height - side) / 2
  return INGREDIENT_IDS.map((id, i) => ({
    id,
    x: Math.round(left + (i % GRID) * cell + inset),
    y: Math.round(top + Math.floor(i / GRID) * cell + inset),
    w: size,
    h: size,
  }))
}

const encodeWithCwebp = async ({ sheetPath, rect, outFile }) => {
  const crop = [rect.x, rect.y, rect.w, rect.h].map(String)
  await run(CWEBP, [
    '-quiet',
    '-crop',
    ...crop,
    '-resize',
    String(OUT_SIZE),
    String(OUT_SIZE),
    '-q',
    String(QUALITY),
    sheetPath,
    '-o',
    outFile,
  ])
}

/** Cuts the sheet into `<id>.webp` files in outDir; every check passes before the first file lands. */
export async function cutSheet({ sheetPath, outDir = OUT_DIR, encode = encodeWithCwebp }) {
  const info = readSheetInfo(await readFile(sheetPath))
  const reason = checkSheet(info)
  if (reason) throw new Error(reason)

  const work = await mkdtemp(join(tmpdir(), 'ingredient-pictures-'))
  try {
    const cut = []
    for (const rect of cropRects(info)) {
      const outFile = join(work, `${rect.id}.webp`)
      await encode({ sheetPath, rect, outFile })
      const { size } = await stat(outFile)
      if (size > MAX_BYTES) throw new Error(`${rect.id}.webp is ${size} bytes, over 30 KB`)
      cut.push({ id: rect.id, bytes: size, file: outFile })
    }
    await mkdir(outDir, { recursive: true })
    for (const { id, file } of cut) await copyFile(file, join(outDir, `${id}.webp`))
    return cut.map(({ id, bytes }) => ({ id, bytes }))
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sheetPath = process.argv[2]
  if (!sheetPath) {
    console.error('usage: node scripts/ingredient-pictures.mjs <sheet.png|sheet.jpg>')
    process.exit(2)
  }
  try {
    for (const { id, bytes } of await cutSheet({ sheetPath })) {
      console.log(`${id}.webp  ${(bytes / 1024).toFixed(1)} KB`)
    }
  } catch (error) {
    console.error(`ingredient-pictures: ${error.message}`)
    process.exit(1)
  }
}
