import { type StencilName, STENCILS, stencilHeight } from '../wand/stencils.ts'
import type { SwordSpec } from './compile.ts'
import { sample } from './curve.ts'

// Runes and engraving as masks over the blade, never geometry: strokes under a millimetre
// are far finer than the blade's columns. The glyphs are the wand's own (decision O4).

export interface BladeMask {
  /** Pixels along the blade (u) and across it (v). */
  width: number
  height: number
  /** Row-major, v rows from x0 to x1, u columns from `from` to `to`: 255 is the full cut. */
  data: Uint8Array
  /** The band in the blade's straight frame: z along (mm) and x across (the blade's uv.x, mm). */
  rect: { from: number; to: number; x0: number; x1: number }
}

/** Pixels per mm, and the largest mask side. */
const DENSITY = 8
const MOST = 2048
/** Glyph cell width over its height (the tile's 0.75 by 1). */
const GLYPH_ASPECT = 0.75
/** The part of a glyph cell holding strokes, across its width (clear of the tile's column cut). */
const CELL: [number, number] = [0.06, 0.69]
const SOFT_EDGE = 1.5

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** A small integer hash, so each glyph's choice follows from the seed alone. */
function pick(seed: number, k: number): number {
  let h = (seed ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

/** Edge-side and back-side half-widths of the blade's outline at z, before waves. */
function widthsAt(spec: SwordSpec, z: number): [number, number] {
  const b = spec.blade
  const u = clamp((z - b.from) / (b.to - b.from), 0, 1)
  const edge = sample(b.halfWidth, u)
  return [edge, b.backWidth ? sample(b.backWidth, u) : edge]
}

function raster(
  from: number,
  to: number,
  centre: (z: number) => number,
  span: number,
  value: (z: number, across: number) => number,
): BladeMask {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i <= 32; i++) {
    const c = centre(from + ((to - from) * i) / 32)
    lo = Math.min(lo, c - span)
    hi = Math.max(hi, c + span)
  }
  const ppm = Math.min(DENSITY, MOST / (to - from), MOST / (hi - lo))
  const width = Math.max(2, Math.ceil((to - from) * ppm))
  const height = Math.max(2, Math.ceil((hi - lo) * ppm))
  const data = new Uint8Array(width * height)
  for (let i = 0; i < width; i++) {
    const z = from + ((i + 0.5) / width) * (to - from)
    const c = centre(z)
    for (let j = 0; j < height; j++) {
      const x = lo + ((j + 0.5) / height) * (hi - lo)
      const across = x - c
      if (Math.abs(across) > span) continue
      data[j * width + i] = Math.round(255 * clamp(value(z, across), 0, 1))
    }
  }
  return { width, height, data, rect: { from, to, x0: lo, x1: hi } }
}

/** The runes' cut as a mask over their band, or null without runes. */
export function runeMask(spec: SwordSpec): BladeMask | null {
  const r = spec.runes
  if (!r) return null
  const b = spec.blade
  const fuller =
    r.where === 'fuller'
      ? b.fullers.reduce<(typeof b.fullers)[number] | null>(
          (a, f) => (a && Math.abs(a.offset - 0.5) <= Math.abs(f.offset - 0.5) ? a : f),
          null,
        )
      : null
  const centre = (z: number) => {
    const [edge, back] = widthsAt(spec, z)
    return fuller ? edge - fuller.offset * (edge + back) : (edge - back) / 2
  }
  // On a ridge the glyphs step from one side of it to the other.
  const stagger = !fuller && b.section === 'diamond'
  const size = stagger ? 0.9 * r.halfHeight : r.halfHeight
  const span = stagger ? 2.1 * r.halfHeight : r.halfHeight
  const pitch = (r.to - r.from) / r.glyphs
  const cellLength = 2 * size * GLYPH_ASPECT
  // The eight glyphs shuffled afresh for each run of eight, never the same twice in a row.
  const glyphs: number[] = []
  for (let cycle = 0; glyphs.length < r.glyphs; cycle++) {
    const order = [0, 1, 2, 3, 4, 5, 6, 7]
    for (let i = 7; i > 0; i--) {
      const j = pick(r.seed + cycle * 7919, i) % (i + 1)
      ;[order[i], order[j]] = [order[j]!, order[i]!]
    }
    if (order[0] === glyphs[glyphs.length - 1]) order.push(order.shift()!)
    glyphs.push(...order)
  }
  return raster(r.from, r.to, centre, span, (z, across) => {
    const k = Math.min(r.glyphs - 1, Math.floor((z - r.from) / pitch))
    const lx = (z - (r.from + (k + 0.5) * pitch)) / cellLength + 0.5
    const mid = stagger ? (k % 2 === 0 ? -1 : 1) * 1.05 * r.halfHeight : 0
    const ly = (across - mid) / (2 * size) + 0.5
    if (lx < 0 || lx > 1 || ly < 0 || ly > 1) return 0
    const glyph = glyphs[k]!
    const col = Math.floor(glyph / 4)
    const row = glyph % 4
    const gx = 0.75 * col + CELL[0] + (CELL[1] - CELL[0]) * lx
    return 1 - stencilHeight('runes', gx / 1.5 - 0.25, (row + ly) / 4)
  })
}

const tileTops = new Map<string, number>()
/** A tile's uncut surface height: steel the stencil leaves alone must stay uncut. */
function tileTop(name: StencilName): number {
  let top = tileTops.get(name)
  if (top === undefined) {
    top = 0
    for (let j = 0; j < 64; j++)
      for (let i = 0; i < 64; i++) top = Math.max(top, stencilHeight(name, i / 64, j / 64))
    tileTops.set(name, top)
  }
  return top
}
/** The panel fades out over this much at its far end, mm. */
const FAR_FADE = 8

/** The engraving's cut as a mask over the blade's base, or null without engraving. */
export function engravingMask(spec: SwordSpec): BladeMask | null {
  const e = spec.engraving
  if (!e) return null
  const tile = STENCILS[e.tile]
  // A vine runs as one stem down the band's middle; the other tiles keep their own size.
  const length =
    e.tile === 'vine' ? (2 * e.halfHeight) / tile.aspect : (tile.lengthMm[0] + tile.lengthMm[1]) / 2
  const centre = (z: number) => {
    const [edge, back] = widthsAt(spec, z)
    return (edge - back) / 2
  }
  return raster(e.from, e.to, centre, e.halfHeight, (z, across) => {
    const fade =
      smoothstep(0, SOFT_EDGE, z - e.from) *
      smoothstep(0, FAR_FADE, e.to - z) *
      smoothstep(0, SOFT_EDGE, e.halfHeight - Math.abs(across))
    const top = tileTop(e.tile)
    const h = stencilHeight(e.tile, across / (length * tile.aspect) + 0.5, (z - e.from) / length)
    return (Math.max(0, top - h) / top) * fade
  })
}
