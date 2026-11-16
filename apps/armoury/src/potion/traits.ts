// What each trait draws in its band of liquid (ADR 0109, "Traits"): weights for the liquid's
// shader and the kind of motes it carries, with an ingredient's own variant. Three-free; the stage
// reads it, and the motes' layout below is the pure half of `stage/LiquidMotes.tsx`.

import { type IngredientId, ingredient, type Trait } from './ingredients.ts'
import type { BottleProfile } from './profile.ts'
import { BASE_MM } from './profile.ts'
import { MAX_POURS } from './potionSchema.ts'

/** How much of each shader look a band takes; the shader blends them across the soft edges. */
export interface TraitShading {
  cloud: number
  swirl: number
  /** Snailshine's pearly sheen on its swirl. */
  pearl: number
  glow: number
  /** Fine flecks in the liquid's skin, under the glitter's motes. */
  fleck: number
  /** Bubbles clinging to the glass, under the fizz's rising motes. */
  cling: number
}

export type MoteKind = 'fleck' | 'bubble' | 'spore' | 'speck'

export interface TraitLook {
  shading: TraitShading
  motes: MoteKind | null
  /** The flecks' or spores' own colour (sRGB); null takes the band's. */
  tint: string | null
}

const NONE: TraitShading = { cloud: 0, swirl: 0, pearl: 0, glow: 0, fleck: 0, cling: 0 }

export const TRAIT_LOOKS: Record<Trait, TraitLook> = {
  clear: { shading: NONE, motes: null, tint: null },
  cloud: { shading: { ...NONE, cloud: 1 }, motes: null, tint: null },
  fizz: { shading: { ...NONE, cling: 1 }, motes: 'bubble', tint: null },
  glitter: { shading: { ...NONE, fleck: 1 }, motes: 'fleck', tint: '#ffe4a0' },
  glow: { shading: { ...NONE, glow: 1 }, motes: null, tint: null },
  swirl: { shading: { ...NONE, swirl: 1 }, motes: null, tint: null },
  murk: { shading: { ...NONE, cloud: 0.8 }, motes: 'speck', tint: '#e6d49c' },
}

/** An ingredient's own take on its trait; dropped if its trait is ever cut to another. */
const VARIANTS: Partial<Record<IngredientId, { of: Trait; look: Partial<TraitLook> }>> = {
  thundercloud: { of: 'glitter', look: { tint: '#e4eaff' } },
  snailshine: { of: 'swirl', look: { shading: { ...NONE, swirl: 1, pearl: 1 } } },
  puffcap: { of: 'cloud', look: { motes: 'spore', tint: '#ffc9b8' } },
}

/** The look of `trait` in a band of `id`, or of a mix whose main ingredient is `id`. */
export function traitLook(trait: Trait, id?: IngredientId | null): TraitLook {
  const variant = id ? VARIANTS[id] : undefined
  const base = TRAIT_LOOKS[trait]
  return variant && variant.of === trait && ingredient(id!).trait === trait
    ? { ...base, ...variant.look }
    : base
}

export interface MoteProgram {
  /** The program's number in the motes' shader; 0 is no mote. */
  code: number
  /** The share of the layout a band of it shows. */
  density: number
  /** The fewest a band of it may show, in any pose (a unit test). */
  least: number
}

export const MOTE_PROGRAMS: Record<MoteKind, MoteProgram> = {
  fleck: { code: 1, density: 1, least: 25 },
  bubble: { code: 2, density: 1, least: 25 },
  spore: { code: 3, density: 0.9, least: 20 },
  speck: { code: 4, density: 1, least: 20 },
}

/** Every mote a bottle can show, whatever its layers: one draw. */
export const MAX_MOTES = 300
/** Each mote's rest point keeps this far inside the cavity's wall, mm. */
const WALL_CLEAR_MM = 1.2

export interface MotePool {
  /** Rest points in the bottle's millimetre frame, three per mote. */
  rest: Float32Array
  /** Four numbers in [0, 1) per mote: its share (against density), and three for its motion. */
  seed: Float32Array
  count: number
}

/**
 * The bottle's motes: rest points spread evenly through its whole cavity, so a level band of any
 * pose holds its share of them and three bands of one ingredient never repeat one pattern.
 */
export function motePool(profile: BottleProfile, count = MAX_MOTES): MotePool {
  let state = 0x2f6b
  const rand = () => {
    state = (state * 16807) % 2147483647
    return state / 2147483647
  }
  const lo = BASE_MM + WALL_CLEAR_MM
  const hi = profile.cavityTopZ - WALL_CLEAR_MM
  let reach = 0
  for (let z = lo; z <= hi; z += 0.5) reach = Math.max(reach, profile.innerR(z))
  const volume = profile.cavityVolume(profile.cavityTopZ)
  let spacing = 0.75 * Math.cbrt(volume / count)
  const rest = new Float32Array(count * 3)
  const seed = new Float32Array(count * 4)
  let n = 0
  let misses = 0
  while (n < count) {
    const x = (rand() * 2 - 1) * reach
    const y = (rand() * 2 - 1) * reach
    const z = lo + rand() * (hi - lo)
    if (Math.hypot(x, y) > profile.innerR(z) - WALL_CLEAR_MM) continue
    let near = false
    for (let i = 0; i < n && !near; i++)
      near =
        (rest[3 * i]! - x) ** 2 + (rest[3 * i + 1]! - y) ** 2 + (rest[3 * i + 2]! - z) ** 2 <
        spacing * spacing
    if (near) {
      if (++misses > 400) {
        spacing *= 0.9
        misses = 0
      }
      continue
    }
    rest.set([x, y, z], 3 * n)
    seed.set([rand(), rand(), rand(), rand()], 4 * n)
    n++
  }
  return { rest, seed, count }
}

export interface CavityRadii {
  /** The liquid's radius at `n` heights from z0 in steps of dz, mm. */
  radii: Float32Array
  z0: number
  dz: number
  /** A band's height in a full bottle, upright: the fixed length every bubble's rise is timed on, mm. */
  rise: number
}

/** The cavity's radius less the liquid's gap, sampled up its height for the motes' shader. */
export function cavityRadii(profile: BottleProfile, n: number, gap: number): CavityRadii {
  const z0 = BASE_MM
  const dz = (profile.cavityTopZ - z0) / (n - 1)
  const radii = Float32Array.from({ length: n }, (_, i) =>
    Math.max(0, profile.innerR(z0 + i * dz) - gap),
  )
  return { radii, z0, dz, rise: (profile.fullZ - z0) / MAX_POURS }
}

type Vec3 = readonly [number, number, number] | ArrayLike<number>

/** The band a point at `p` lies in for tops `levels` along `up` over `floor`, or -1 above the surface. */
export function moteBand(p: Vec3, up: Vec3, levels: readonly number[], floor: number): number {
  const h = p[0] * up[0] + p[1] * up[1] + p[2] * up[2]
  if (levels.length === 0 || h < floor) return -1
  for (let i = 0; i < levels.length; i++) if (h <= levels[i]!) return i
  return -1
}

/** A mote fades out over this much, mm, as its rest point nears its band's floor or top. */
export const MOTE_EDGE_MM = 1.5

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** How much shows of a mote resting at height `h0` in a band from `lo` to `hi`: none at either edge. */
export function moteEdgeFade(h0: number, lo: number, hi: number): number {
  const e = Math.max(0.01, Math.min(MOTE_EDGE_MM, 0.25 * (hi - lo)))
  return smoothstep(lo, lo + e, h0) * (1 - smoothstep(hi - e, hi, h0))
}

/** How much shows of the mote resting at `p`, by its band's edges; 0 above the surface. */
export function moteShown(p: Vec3, up: Vec3, levels: readonly number[], floor: number): number {
  const band = moteBand(p, up, levels, floor)
  if (band < 0) return 0
  const h = p[0] * up[0] + p[1] * up[1] + p[2] * up[2]
  return moteEdgeFade(h, band === 0 ? floor : levels[band - 1]!, levels[band]!)
}

/** How many motes each band shows well (half or more) at rest, for bands carrying `kinds` (the shader's own rule). */
export function motesShown(
  pool: MotePool,
  up: Vec3,
  levels: readonly number[],
  floor: number,
  kinds: readonly (MoteKind | null)[],
): number[] {
  const counts = levels.map(() => 0)
  for (let i = 0; i < pool.count; i++) {
    const rest = pool.rest.subarray(3 * i, 3 * i + 3)
    const band = moteBand(rest, up, levels, floor)
    const kind = band < 0 ? null : kinds[band]
    if (
      kind &&
      pool.seed[4 * i]! < MOTE_PROGRAMS[kind].density &&
      moteShown(rest, up, levels, floor) >= 0.5
    )
      counts[band]!++
  }
  return counts
}

/** The bubbles' streams stand on this lattice in the bottle's own frame, mm. */
export const BUBBLE_CELL_MM = 10
/** Seven in ten bubbles rise in a stream, the rest on their own. */
export const BUBBLE_STREAMED = 0.7
/** A bubble climbs `base` to `base + spread` mm a second, by its seed. */
export const BUBBLE_SPEED = { base: 6, spread: 6 }
/** A bubble sways `mm` sideways at `rate` rad a second, more the higher it is. */
export const BUBBLE_SWAY = { mm: 0.25, rate: 7, phase: 50 }
/** A bubble shows over the first `BUBBLE_FADE_IN` of its rise and is gone by the last `1 - BUBBLE_FADE_OUT`. */
export const BUBBLE_FADE_IN = 0.08
export const BUBBLE_FADE_OUT = 0.86

const fract = (v: number) => v - Math.floor(v)

/** A murk's speck sinks `base` to `base + spread` mm a second, by its seed. */
export const SPECK_SPEED = { base: 1.2, spread: 1.4 }
/** A speck shows from the first `in` of its fall and is gone by the last `1 - out`. */
export const SPECK_FADE = { in: 0.1, out: 0.85 }

/** How far down its band a speck is, 0 to 1, at time `t`: on a fixed length, as a bubble rises. */
export function speckFall(seed: Vec3 | readonly number[], t: number, fallMm: number): number {
  return fract(seed[1] + (t * (SPECK_SPEED.base + SPECK_SPEED.spread * seed[2])) / fallMm)
}

/** How much shows of a speck `fall` of the way down. */
export const speckFade = (fall: number) =>
  smoothstep(0, SPECK_FADE.in, fall) * (1 - smoothstep(SPECK_FADE.out, 1, fall))

/** As the liquid mixes, each mote changes to the mix's program at its own moment from `from` over `span` of the mix, unseen within `fade` of it. */
export const MOTE_TURN = { from: 0.2, span: 0.6, fade: 0.15 }

/** Whether a mote plays the mix's program yet at `mix` (0 the layers, 1 the mix), and how much of it shows. */
export function moteTurn(seed: ArrayLike<number>, mix: number): { mixed: boolean; shown: number } {
  const turnAt = MOTE_TURN.from + MOTE_TURN.span * fract(seed[3]! * 13 + seed[1]! * 7)
  return { mixed: mix > turnAt, shown: smoothstep(0, MOTE_TURN.fade, Math.abs(mix - turnAt)) }
}

/** The motes' shader's hash, three numbers in [0, 1) from a point. */
export function motesHash3(x: number, y: number, z: number): [number, number, number] {
  let [a, b, c] = [fract(x * 0.1031), fract(y * 0.103), fract(z * 0.0973)]
  const d = a * b + b * a + c * c + 33.33 * (a + b + c)
  ;[a, b, c] = [a + d, b + d, c + d]
  return [fract((a + b) * c), fract((a + a) * b), fract((b + a) * a)]
}

/** How far up its band a bubble is, 0 to 1, at time `t`: on a fixed length, so a band's moving span never jumps it. */
export function bubbleRise(seed: Vec3 | readonly number[], t: number, riseMm: number): number {
  return fract(seed[1] + (t * (BUBBLE_SPEED.base + BUBBLE_SPEED.spread * seed[2])) / riseMm)
}

/**
 * Where the bubble resting at `rest` is at time `t`, rising in band `band` from `lo` to `hi`
 * along `up` (the TypeScript twin of the motes' shader), and how much its rise lets show.
 */
export function bubbleAt(
  rest: Vec3,
  seed: Vec3 | readonly number[],
  up: Vec3,
  band: number,
  lo: number,
  hi: number,
  t: number,
  riseMm: number,
): { p: [number, number, number]; rise: number; fade: number } {
  let anchor: [number, number, number] = [rest[0], rest[1], rest[2]]
  if (seed[3]! < BUBBLE_STREAMED) {
    const cell = anchor.map((v) => Math.floor(v / BUBBLE_CELL_MM))
    const site = motesHash3(cell[0]!, cell[1]!, band + 0.5)
    anchor = [
      (cell[0]! + 0.2 + 0.6 * site[0]) * BUBBLE_CELL_MM + 0.4 * (seed[2] - 0.5),
      (cell[1]! + 0.2 + 0.6 * site[1]) * BUBBLE_CELL_MM + 0.4 * (seed[1] - 0.5),
      (cell[2]! + 0.5) * BUBBLE_CELL_MM,
    ]
  }
  const rise = bubbleRise(seed, t, riseMm)
  anchor[0] += BUBBLE_SWAY.mm * Math.sin(t * BUBBLE_SWAY.rate + seed[3]! * BUBBLE_SWAY.phase) * rise
  const span = Math.max(hi - lo, 0.5)
  const lift = lo + span * rise - (anchor[0] * up[0] + anchor[1] * up[1] + anchor[2] * up[2])
  const p: [number, number, number] = [
    anchor[0] + up[0] * lift,
    anchor[1] + up[1] * lift,
    anchor[2] + up[2] * lift,
  ]
  return {
    p,
    rise,
    fade: smoothstep(0, BUBBLE_FADE_IN, rise) * (1 - smoothstep(BUBBLE_FADE_OUT, 1, rise)),
  }
}
