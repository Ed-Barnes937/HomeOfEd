// What each trait draws in its band of liquid (ADR 0109, "Traits"): weights for the liquid's
// shader and the kind of motes it carries, with an ingredient's own variant. Three-free; the stage
// reads it, and the motes' layout below is the pure half of `stage/LiquidMotes.tsx`.

import { type IngredientId, ingredient, type Trait } from './ingredients.ts'
import type { BottleProfile } from './profile.ts'
import { BASE_MM } from './profile.ts'

/** How much of each shader look a band takes; the shader blends them across the soft edges. */
export interface TraitShading {
  cloud: number
  swirl: number
  /** Snailshine's pearly sheen on its swirl. */
  pearl: number
  glow: number
  /** Fine flecks in the liquid's skin, under the glitter's motes. */
  fleck: number
}

/** Ticket 23 adds `speck`, the murk's sinking specks. */
export type MoteKind = 'fleck' | 'bubble' | 'spore'

export interface TraitLook {
  shading: TraitShading
  motes: MoteKind | null
  /** The flecks' or spores' own colour (sRGB); null takes the band's. */
  tint: string | null
}

const NONE: TraitShading = { cloud: 0, swirl: 0, pearl: 0, glow: 0, fleck: 0 }

export const TRAIT_LOOKS: Record<Trait, TraitLook> = {
  clear: { shading: NONE, motes: null, tint: null },
  cloud: { shading: { ...NONE, cloud: 1 }, motes: null, tint: null },
  fizz: { shading: NONE, motes: 'bubble', tint: null },
  glitter: { shading: { ...NONE, fleck: 1 }, motes: 'fleck', tint: '#ffe4a0' },
  glow: { shading: { ...NONE, glow: 1 }, motes: null, tint: null },
  swirl: { shading: { ...NONE, swirl: 1 }, motes: null, tint: null },
  murk: { shading: { ...NONE, cloud: 1 }, motes: null, tint: null },
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
}

/** The cavity's radius less the liquid's gap, sampled up its height for the motes' shader. */
export function cavityRadii(profile: BottleProfile, n: number, gap: number): CavityRadii {
  const z0 = BASE_MM
  const dz = (profile.cavityTopZ - z0) / (n - 1)
  const radii = Float32Array.from({ length: n }, (_, i) =>
    Math.max(0, profile.innerR(z0 + i * dz) - gap),
  )
  return { radii, z0, dz }
}

type Vec3 = readonly [number, number, number] | ArrayLike<number>

/** The band a point at `p` lies in for tops `levels` along `up` over `floor`, or -1 above the surface. */
export function moteBand(p: Vec3, up: Vec3, levels: readonly number[], floor: number): number {
  const h = p[0] * up[0] + p[1] * up[1] + p[2] * up[2]
  if (levels.length === 0 || h < floor) return -1
  for (let i = 0; i < levels.length; i++) if (h <= levels[i]!) return i
  return -1
}

/** How many motes each band shows at rest, for bands carrying `kinds` (the shader's own rule). */
export function motesShown(
  pool: MotePool,
  up: Vec3,
  levels: readonly number[],
  floor: number,
  kinds: readonly (MoteKind | null)[],
): number[] {
  const counts = levels.map(() => 0)
  for (let i = 0; i < pool.count; i++) {
    const band = moteBand(pool.rest.subarray(3 * i, 3 * i + 3), up, levels, floor)
    const kind = band < 0 ? null : kinds[band]
    if (kind && pool.seed[4 * i]! < MOTE_PROGRAMS[kind].density) counts[band]!++
  }
  return counts
}
