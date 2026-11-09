// Pattern stencils: original greyscale height tiles, drawn here as functions and
// rasterised once, then carved into the wand by `radiusAt`.

export type StencilName = 'scales' | 'vine' | 'knotwork' | 'runes' | 'dots'

export interface Tile {
  /** Height on the unit tile (x round the wand, y towards the tip): 1 is the surface, 0 the full cut. Periodic in both. */
  draw: (x: number, y: number) => number
  /** The tile's width over its length on the wand. */
  aspect: number
  /** The tile's length along the wand at the smallest and biggest "Pattern size", mm. */
  lengthMm: [number, number]
  /** How deep height 0 cuts, as a fraction of the local radius. */
  depth: number
}

const TAU = Math.PI * 2
const fract = (x: number) => x - Math.floor(x)
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

function segment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

/** Distance to the arc of radius r round (cx, cy) from angle a0 anticlockwise to a1. */
function arc(px: number, py: number, cx: number, cy: number, r: number, a0: number, a1: number) {
  const a = Math.atan2(py - cy, px - cx)
  const into = (((a - a0) % TAU) + TAU) % TAU
  if (into <= a1 - a0) return Math.abs(Math.hypot(px - cx, py - cy) - r)
  const end = (t: number) => Math.hypot(px - cx - r * Math.cos(t), py - cy - r * Math.sin(t))
  return Math.min(end(a0), end(a1))
}

/** A V-cut line of half-width w, at distance d from its centre. */
const vCut = (d: number, w: number) => clamp01(d / w)

/** Overlapping rows of scales, their round edges towards the pommel; the upper row lies over the lower. */
function scales(x: number, y: number): number {
  // Scale units: one scale is 2 wide, rows are 1 apart, and the tile is 2 x 2.
  const px = 2 * x
  const py = 2 * y
  const R = 1.05
  let top: { cx: number; cy: number; d: number } | null = null
  const near: { cx: number; cy: number; d: number }[] = []
  const j0 = Math.floor(py)
  for (let j = j0 - 1; j <= j0 + 2; j++) {
    const shift = j % 2 === 0 ? 0 : 1
    const i0 = Math.floor((px - shift) / 2)
    for (let i = i0 - 1; i <= i0 + 2; i++) {
      const cx = 2 * i + shift
      const d = Math.hypot(px - cx, py - j)
      near.push({ cx, cy: j, d })
      if (d < R && (!top || j > top.cy || (j === top.cy && d < top.d))) top = { cx, cy: j, d }
    }
  }
  if (!top) return 1
  const own = R - top.d
  // How far below the edge of the scale lying over this one.
  // A soft minimum, so there's no crease where the nearest upper scale changes.
  let sum = 0
  for (const s of near) if (s.cy > top.cy) sum += Math.exp(-(s.d - R) / 0.08)
  const under = sum > 0 ? Math.max(0, -0.08 * Math.log(sum)) : Infinity
  const t = under === Infinity ? 1 : under / (under + own)
  // The lip rolls over into the cut rather than dropping sheer, so the mesh never steps along it.
  return 0.25 + 0.75 * Math.sqrt(t) * smoothstep(0, 0.13, own)
}

const VINE_ASPECT = 1.4

/** One leaf, an almond from (bx, by) pointing along angle a: sunk, with its midrib left standing. */
function leaf(px: number, py: number, bx: number, by: number, a: number, length: number) {
  const s = (px - bx) * Math.sin(a) + (py - by) * Math.cos(a)
  const t = (px - bx) * Math.cos(a) - (py - by) * Math.sin(a)
  if (s <= 0 || s >= length) return 1
  const half = 0.11 * Math.sin((Math.PI * s) / length) ** 0.8
  const q = Math.abs(t) / half
  if (q >= 1) return 1
  const rib = Math.exp(-((t / 0.016) ** 2))
  return Math.max(0.2 + 0.5 * rib * smoothstep(0, 0.12 * length, s), smoothstep(0.82, 1, q))
}

const vineStemX = (y: number) => 0.7 + 0.22 * Math.sin(TAU * y)

/** The vine's leaves and tendril, one copy of each. */
function vineLeaves(px: number, py: number): number {
  // Leaves sprout where the stem swings furthest, pointing out and up.
  let h = leaf(px, py, vineStemX(0.25), 0.25, 0.75, 0.4)
  h = Math.min(h, leaf(px, py, vineStemX(0.75), 0.75, -0.75, 0.4))
  const curl = arc(px, py, vineStemX(0.04) - 0.1, 0.1, 0.1, -0.5, 2.8)
  return Math.min(h, vCut(curl, 0.032))
}

const STEM_STEP = 0.02
const STEM = Array.from({ length: 1 / STEM_STEP + 1 }, (_, k) => vineStemX(k * STEM_STEP))

/**
 * A climbing vine: a winding stem with a leaf each side and a curling tendril. The
 * vine keeps clear of the tile's sides, so only its ends need wrapping along the wand.
 */
function vine(x: number, y: number): number {
  const px = x * VINE_ASPECT
  const py = fract(y)
  let stem = Infinity
  const k0 = Math.floor(py / STEM_STEP)
  for (let k = k0 - 8; k <= k0 + 8; k++) {
    const a = ((k % 50) + 50) % 50
    const y0 = k * STEM_STEP
    stem = Math.min(stem, segment(px, py, STEM[a]!, y0, STEM[a + 1]!, y0 + STEM_STEP))
  }
  let h = 1 - Math.sqrt(Math.max(0, 1 - (stem / 0.04) ** 2))
  for (const oy of [-1, 0, 1]) h = Math.min(h, vineLeaves(px, py + oy))
  return h
}

/** A plaited lattice: two families of strands crossing at right angles, over and under in turn. */
function knotwork(x: number, y: number): number {
  const w = 0.13
  const gap = 0.05
  const a = x - y
  const b = x + y - 0.5
  const da = Math.abs(a - Math.round(a)) / Math.SQRT2
  const db = Math.abs(b - Math.round(b)) / Math.SQRT2
  const strand = (d: number) =>
    d < w ? (0.62 + 0.38 * Math.sqrt(1 - (d / w) ** 2)) * smoothstep(w, w - 0.035, d) : 0
  const aOver = (Math.round(a) + Math.round(b)) % 2 === 0
  const [over, under] = aOver ? [da, db] : [db, da]
  const tucked = 0.85 * strand(under) * smoothstep(w, w + gap, over)
  return Math.max(strand(over), tucked, 0.04)
}

type Stroke = (x: number, y: number) => number

const line =
  (ax: number, ay: number, bx: number, by: number): Stroke =>
  (x, y) =>
    segment(x, y, ax, ay, bx, by)
const bend =
  (cx: number, cy: number, r: number, a0: number, a1: number): Stroke =>
  (x, y) =>
    arc(x, y, cx, cy, r, a0, a1)
const ring =
  (cx: number, cy: number, r: number): Stroke =>
  (x, y) =>
    Math.abs(Math.hypot(x - cx, y - cy) - r)
const dot =
  (cx: number, cy: number): Stroke =>
  (x, y) =>
    Math.max(0, Math.hypot(x - cx, y - cy) - 0.035)

const PI = Math.PI
/** Invented glyphs, each in a cell 0.75 wide and 1 tall. */
const GLYPHS: Stroke[][] = [
  [bend(0.375, 0.5, 0.22, 0, PI), dot(0.375, 0.26), line(0.155, 0.5, 0.155, 0.18)],
  [
    line(0.15, 0.85, 0.375, 0.32),
    line(0.375, 0.32, 0.6, 0.85),
    line(0.2, 0.16, 0.55, 0.16),
    dot(0.375, 0.62),
  ],
  [bend(0.375, 0.56, 0.2, 0.5 * PI, 2 * PI), line(0.575, 0.56, 0.575, 0.14)],
  [
    line(0.15, 0.86, 0.6, 0.66),
    line(0.6, 0.66, 0.15, 0.46),
    line(0.15, 0.46, 0.6, 0.26),
    dot(0.24, 0.14),
  ],
  [
    line(0.375, 0.32, 0.375, 0.88),
    line(0.375, 0.74, 0.6, 0.6),
    line(0.375, 0.56, 0.15, 0.43),
    ring(0.375, 0.2, 0.09),
  ],
  [
    bend(0.45, 0.5, 0.14, 0.5 * PI, 1.5 * PI),
    bend(0.45, 0.5, 0.3, 0.5 * PI, 1.5 * PI),
    dot(0.45, 0.5),
  ],
  [
    bend(0.25, 0.62, 0.125, 0, PI),
    bend(0.5, 0.62, 0.125, PI, 2 * PI),
    line(0.375, 0.14, 0.375, 0.44),
  ],
  [
    line(0.15, 0.18, 0.15, 0.6),
    line(0.15, 0.6, 0.42, 0.84),
    line(0.42, 0.84, 0.6, 0.62),
    dot(0.44, 0.4),
  ],
]

/** Two columns of four invented glyphs, with a cut line between the columns. */
function runes(x: number, y: number): number {
  // Shifted a quarter, so a column of glyphs sits in the tile's middle.
  const gx = fract(x + 0.25) * 1.5
  const gy = fract(y) * 4
  const col = Math.min(1, Math.floor(gx / 0.75))
  const row = Math.min(3, Math.floor(gy))
  const strokes = GLYPHS[col * 4 + row]!
  const lx = gx - 0.75 * col
  const ly = gy - row
  let d = Math.min(gx, 1.5 - gx) + 0.01
  for (const s of strokes) d = Math.min(d, s(lx, ly))
  return vCut(d, 0.06)
}

const ROW = Math.sqrt(3) / 2

/** Round dimples on a staggered grid. */
function dots(x: number, y: number): number {
  const px = x
  const py = 2 * ROW * y
  const r = 0.3
  let h = 1
  const j0 = Math.floor(py / ROW)
  for (let j = j0 - 1; j <= j0 + 2; j++) {
    const shift = j % 2 === 0 ? 0 : 0.5
    for (let i = Math.floor(px - shift) - 1; i <= Math.floor(px - shift) + 2; i++) {
      const d = Math.hypot(px - i - shift, py - j * ROW)
      if (d < r) h = Math.min(h, 1 - Math.sqrt(1 - (d / r) ** 2))
    }
  }
  return h
}

export const STENCILS: Record<StencilName, Tile> = {
  scales: { draw: scales, aspect: 1, lengthMm: [4.8, 8.4], depth: 0.07 },
  vine: { draw: vine, aspect: VINE_ASPECT, lengthMm: [11, 18], depth: 0.08 },
  knotwork: { draw: knotwork, aspect: 1, lengthMm: [6, 10], depth: 0.06 },
  runes: { draw: runes, aspect: 0.375, lengthMm: [20, 30], depth: 0.07 },
  dots: { draw: dots, aspect: 1 / (2 * ROW), lengthMm: [3.8, 6.9], depth: 0.08 },
}

/** Raster rows along one tile; columns follow its aspect. */
const RASTER = 256

interface Raster {
  nx: number
  ny: number
  h: Float32Array
}

const rasters = new Map<StencilName, Raster>()

function rasterFor(name: StencilName): Raster {
  const cached = rasters.get(name)
  if (cached) return cached
  const { draw, aspect } = STENCILS[name]
  const ny = RASTER
  const nx = Math.max(32, Math.round(RASTER * aspect))
  const h = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) h[j * nx + i] = draw(i / nx, j / ny)
  const raster = { nx, ny, h }
  rasters.set(name, raster)
  return raster
}

/** The tile's height at (u, v), in tiles round and along the wand; wraps both ways. */
export function stencilHeight(name: StencilName, u: number, v: number): number {
  const { nx, ny, h } = rasterFor(name)
  const x = fract(u) * nx
  const y = fract(v) * ny
  const i0 = Math.floor(x)
  const j0 = Math.floor(y)
  const fx = x - i0
  const fy = y - j0
  const i1 = (i0 + 1) % nx
  const j1 = (j0 + 1) % ny
  const a = h[j0 * nx + i0]! + (h[j0 * nx + i1]! - h[j0 * nx + i0]!) * fx
  const b = h[j1 * nx + i0]! + (h[j1 * nx + i1]! - h[j1 * nx + i0]!) * fx
  return a + (b - a) * fy
}
