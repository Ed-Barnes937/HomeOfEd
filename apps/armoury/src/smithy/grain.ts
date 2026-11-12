import { seededRandom } from '../engine/schema.ts'

// Grain and mottle for the smithy's stone, soot and floor: small seamless tiles made once on a
// canvas and baked into the art, since an SVG noise filter over the wall costs far more to paint.

function noise(cells: number, seed: number): HTMLCanvasElement {
  const rand = seededRandom(seed)
  const canvas = document.createElement('canvas')
  canvas.width = cells
  canvas.height = cells
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(cells, cells)
  for (let i = 0; i < cells * cells; i++) {
    const v = rand()
    const light = v > 0.5
    image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = light ? 255 : 0
    image.data[i * 4 + 3] = Math.round(Math.abs(v - 0.5) * 2 * (light ? 45 : 90))
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

/** Noise of cells grown smoothly to size; a one-cell wrapped border keeps the tile seamless. */
function tile(size: number, cells: number, seed: number): HTMLCanvasElement {
  const small = noise(cells, seed)
  const padded = document.createElement('canvas')
  padded.width = cells + 2
  padded.height = cells + 2
  const pctx = padded.getContext('2d')!
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++) pctx.drawImage(small, 1 + x * cells, 1 + y * cells)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = cells < size
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(padded, 1, 1, cells, cells, 0, 0, size, size)
  return canvas
}

/** The two tiles as PNG data URLs: fine grain at 1:1, mottle to be drawn at twice its size. */
export interface Grain {
  fine: string
  mottle: string
}

let made: Grain | null = null

/** The tiles, made on first use; null outside a browser. */
export function grain(): Grain | null {
  if (typeof document === 'undefined') return null
  made ??= {
    fine: tile(128, 128, 77).toDataURL(),
    mottle: tile(320, 10, 91).toDataURL(),
  }
  return made
}
