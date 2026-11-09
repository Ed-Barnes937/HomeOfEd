import { seededRandom, type Params } from '../engine/schema.ts'
import { placeGems, type GemPattern, type SetGem } from './gems.ts'
import { STENCILS, type StencilName } from './stencils.ts'
import {
  hasStencil,
  hasTurnedHandle,
  isBranch,
  stencilPlaces,
  swatchFor,
  usesMetal,
} from './wandSchema.ts'

// Compiles kid-level choices into a geometric spec: a radial profile along the
// wand, plus a list of groove sets carved out of it. All lengths are mm, and z
// runs from 0 at the pommel to lengthMm at the tip.

interface GrooveCommon {
  count: number
  /** Fraction of the local profile radius cut away (or, raised, added) at full strength. */
  depth: number
  /** Turns per mm along z. Sign is the spiral direction. */
  twist: number
  from: number
  to: number
  fadeIn: number
  fadeOut: number
  /** Angular half-width of a round groove, radians. */
  halfWidth: number
}

/** Only a round set can be raised: a raised flat set would be a no-op. A raised set's ridge may be metal. */
export type GrooveSet =
  | (GrooveCommon & { shape: 'flat' })
  | (GrooveCommon & { shape: 'round'; raised?: boolean; metal?: boolean })

export interface StainSpec {
  /** The stain's swatch in linear RGB, whose hue and darkness a full coat absorbs; null for natural wood. */
  colour: [number, number, number] | null
  strength: number
  /** Fraction of the length, from the pommel, where the stain is half faded. */
  reach: number
  softness: number
}

export type Material = 'metal' | 'paint' | 'bone'

/** A stretch of the wand, pommel side first, in something other than wood. Later zones cover earlier ones. */
export interface Zone {
  material: Material
  from: number
  to: number
  /** Carving stops at it, as at a ring clamped over the wood. */
  uncarved?: boolean
}

/** A pointed hexagonal crystal that is the last stretch of the wand, from `from` to the tip. */
export interface Crystal {
  from: number
  radius: number
}

/** A round stone that is the pommel, touching z = 0. */
export interface Orb {
  centre: number
  radius: number
}

/** A knot in straight (angle, z) space. */
export interface Knot {
  theta: number
  z: number
  /** Height of the boss as a fraction of the local radius. */
  height: number
  /** Radius of the boss on the surface, mm. */
  width: number
}

/** One sideways wave of the spine; `amp` is mm. */
export interface Wiggle {
  freq: number
  dir: number
  phase: number
  amp: number
}

/** A low-frequency ripple in the radius, `m` times round the wand and `k` radians per mm along it. */
export interface Lump {
  m: number
  k: number
  phase: number
  amp: number
}

export type BarkCover = 'patches' | 'full'

/** Bark over a branch's wood, furrowed along the grain, in patches or all over. */
export interface BarkSpec {
  cover: BarkCover
  /** How long a patch of bark is along the wand, roughly, mm. */
  patchMm: number
  /** A grown handle is worn bare up to about here, mm; 0 for a turned handle. */
  wornTo: number
  /** How far bark stands proud of the wood, as a fraction of the local radius. */
  thickness: number
  /** Cells of ragged noise round the wand, and their length along it, mm. */
  around: number
  raggedMm: number
  /** Furrows round the wand at the shaft's base, and how far one runs before it wanders, mm. */
  furrows: number
  furrowMm: number
  seed: number
}

/** What makes a wand a branch: its bent spine, lumps and knots. */
export interface BranchSpec {
  /** Bow amplitude, mm, and the direction it bows in. */
  bowMm: number
  bowDir: number
  wiggles: Wiggle[]
  /** The most the lumps add to or take from the radius, as a fraction of it. */
  gnarl: number
  lumps: Lump[]
  /** Lumps and knots grow in from here: the butt of a grown handle, past the ring of a turned one. */
  from: number
  knots: Knot[]
  bark: BarkSpec | null
}

/** A stretch of the wand a stencil covers, a whole number of tiles long and round. */
export interface StencilBand {
  from: number
  to: number
  /** One tile's length along the wand, mm. */
  length: number
  /** Tiles round the wand. */
  around: number
}

/** An engraving: one tile, cut into bands that keep clear of metal. */
export interface StencilSpec {
  tile: StencilName
  /** How deep the tile's floor cuts, as a fraction of the local radius. */
  depth: number
  bands: StencilBand[]
}

export interface WandSpec {
  lengthMm: number
  /** Where the turned body starts and ends; end gems fill the rest of the length. */
  bodyFrom: number
  bodyTo: number
  handleMm: number
  handleMaxR: number
  shaftBaseR: number
  tipR: number
  profile: (z: number) => number
  grooves: GrooveSet[]
  stain: StainSpec
  wood: string
  zones: Zone[]
  /** The one metal every metal part is made of. */
  metal: string
  /** The paint's swatch in linear RGB. */
  paint: [number, number, number]
  /** Colour of the spell cast from the tip, decided by the core. */
  spell: string
  gems: SetGem[]
  crystal: Crystal | null
  orb: Orb | null
  /** Gem settings (rims, the crystal's cup) are the wand's metal when it has any. */
  metalSettings: boolean
  /** Null for a turned wand, which is always straight. */
  branch: BranchSpec | null
  stencil: StencilSpec | null
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Half-round bump (bead) of height h (mm, negative cuts a cove) and half-width w. */
const bead = (z: number, c: number, w: number, h: number) => {
  const x = (z - c) / w
  return Math.abs(x) < 1 ? h * Math.sqrt(1 - x * x) : 0
}

/** Superellipse end cap: 1 away from the end, falling to 0 at distance 0. */
const cap = (d: number, length: number, p: number) => {
  if (d >= length) return 1
  if (d <= 0) return 0
  return Math.pow(1 - Math.pow((length - d) / length, p), 1 / p)
}

/** Smooth curve through [t, value] points (cosine interpolation, flat at points). */
function curve(points: [number, number][], t: number): number {
  if (t <= points[0]![0]) return points[0]![1]
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i]!
    if (t <= t1) {
      const [t0, v0] = points[i - 1]!
      const u = (t - t0) / (t1 - t0)
      return lerp(v0, v1, (1 - Math.cos(Math.PI * u)) / 2)
    }
  }
  return points[points.length - 1]![1]
}

interface HandleStyle {
  /** Handle length as a fraction of the wand. */
  ratio: number
  /** Body outline: [t along handle, radius as fraction of handle max]. */
  body: [number, number][]
  /** Turned beads: t along handle, half-width mm, height as fraction of handle max. */
  beads: { t: number; w: number; h: number }[]
  /** The stretch of handle that carving applies to. */
  carve: [number, number]
  depth: number
  /** Where a metal end cap stops, as a fraction of the handle. */
  cap: number
  /** Where a ring of gems goes round the handle, as a fraction of it. */
  belt: number
}

// Handle styles are data: new styles cost a table entry, not code.
const HANDLE_STYLES: Record<string, HandleStyle> = {
  plain: {
    ratio: 0.26,
    body: [
      [0, 0.85],
      [0.2, 0.97],
      [0.45, 1],
      [0.85, 0.82],
      [1, 0.8],
    ],
    beads: [{ t: 0.93, w: 1.4, h: 0.1 }],
    carve: [0.12, 0.86],
    depth: 0.1,
    cap: 0.1,
    belt: 0.5,
  },
  ringed: {
    ratio: 0.28,
    body: [
      [0, 0.95],
      [0.12, 0.82],
      [0.5, 0.88],
      [1, 0.8],
    ],
    beads: [
      { t: 0.14, w: 1.8, h: 0.16 },
      { t: 0.38, w: 1.8, h: 0.16 },
      { t: 0.62, w: 1.8, h: 0.16 },
      { t: 0.86, w: 1.8, h: 0.16 },
    ],
    carve: [0.18, 0.82],
    depth: 0.12,
    cap: 0.16,
    belt: 0.5,
  },
  spiral: {
    ratio: 0.32,
    body: [
      [0, 0.8],
      [0.07, 0.92],
      [0.15, 0.66],
      [0.24, 0.82],
      [0.6, 1],
      [0.92, 0.82],
      [1, 0.8],
    ],
    beads: [{ t: 0.2, w: 1.2, h: 0.08 }],
    carve: [0.24, 0.96],
    depth: 0.14,
    cap: 0.15,
    belt: 0.6,
  },
  gemcut: {
    ratio: 0.33,
    body: [
      [0, 0.95],
      [0.07, 0.8],
      [0.14, 0.78],
      [0.22, 0.95],
      [0.55, 1],
      [0.9, 0.9],
      [1, 0.85],
    ],
    beads: [{ t: 0.15, w: 1.4, h: 0.14 }],
    carve: [0.22, 0.96],
    depth: 0.12,
    cap: 0.07,
    belt: 0.6,
  },
}

// Collar between handle and shaft: length mm, and beads at fractions of it.
export const COLLARS: Record<
  string,
  { length: number; beads: { t: number; w: number; h: number }[] }
> = {
  vcut: { length: 4, beads: [{ t: 0.5, w: 0.8, h: -0.7 }] },
  bead: { length: 6, beads: [{ t: 0.5, w: 2.2, h: 1.4 }] },
  beadPair: {
    length: 10,
    beads: [
      { t: 0.28, w: 2.0, h: 1.4 },
      { t: 0.72, w: 2.0, h: 1.4 },
    ],
  },
  ringStack: {
    length: 12,
    beads: [
      { t: 0.2, w: 1.8, h: 1.3 },
      { t: 0.5, w: 1.0, h: 0.9 },
      { t: 0.8, w: 1.8, h: 1.3 },
    ],
  },
}

/** A grown handle's length as a fraction of the wand. */
const GROWN_HANDLE = 0.27
const GROWN_STYLE = { ratio: GROWN_HANDLE, cap: 0.1, belt: 0.5 }
const TAU = Math.PI * 2

const BAND_COUNTS: Record<string, number> = { none: 0, one: 1, two: 2, three: 3 }
const BAND_HALF_WIDTH = 1.5
const BAND_HEIGHT = 0.45
/** How far the crystal's base sinks into its cup, mm. */
const CRYSTAL_SEAT = 2
const CUP_LENGTH = 7

/** Cosine bump: 1 at the centre c, easing to 0 at half-width w either side. */
const swell = (z: number, c: number, w: number) => {
  const x = (z - c) / w
  return Math.abs(x) < 1 ? (1 + Math.cos(Math.PI * x)) / 2 : 0
}

function srgbToLinear(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)]
}

export function compileWand(p: Params): WandSpec {
  const lengthCm = p.lengthCm as number
  const L = lengthCm * 10
  const branch = isBranch(p)
  const grown = !hasTurnedHandle(p)
  const turnedStyle = HANDLE_STYLES[p.handleStyle as string] ?? HANDLE_STYLES.plain!
  const style = grown ? GROWN_STYLE : turnedStyle
  const collar = COLLARS[p.collarStyle as string] ?? COLLARS.bead!

  // Coupling, calibrated on the measured 12" reference wand: handle 15mm,
  // shaft base about 11mm, tip about 10mm.
  const handleMaxR = (clamp(L * 0.049, 13, 19) * (p.thickness as number)) / 2
  const shaftBaseR = clamp(handleMaxR * 2 - 4, 9, 14) / 2
  const tipR = shaftBaseR * (1 - 0.45 * (p.pointy as number))
  const taperHold = clamp(0.25 + (lengthCm - 28) * 0.015, 0, 0.6)

  const H = style.ratio * L
  const collarEnd = H + (grown ? 0 : collar.length)
  const handleEndR = curve(turnedStyle.body, 1) * handleMaxR

  const endShape = p.endShape as string
  const ballR = handleMaxR * 0.95
  const tipShape = p.tipShape as string

  // End gems replace the ends of the turned body rather than adding to the length.
  const crystalR = Math.max(tipR, 0.75 * shaftBaseR)
  const crystal: Crystal | null =
    p.tipGem === 'crystal' ? { from: L - 5 * crystalR, radius: crystalR } : null
  const orb: Orb | null = p.endGem === 'orb' ? { centre: ballR, radius: ballR } : null
  const bodyFrom = orb ? 1.65 * orb.radius : 0
  const bodyTo = crystal ? crystal.from + CRYSTAL_SEAT : L

  const nodes = p.nodes as string
  const nodeCount = p.nodeCount as number
  const nodeStart = collarEnd + 6
  const nodeEnd = bodyTo * 0.86
  const nodeSpacing = (nodeEnd - nodeStart) / nodeCount
  const nodeHeight = lerp(0.12, 0.35, p.nodeSize as number)
  const knobWidth = clamp(0.3 * nodeSpacing, 3, 9)
  // Each bump, as a fraction of the local radius; they shrink towards the tip.
  const nodeSwell = (z: number): number => {
    if (nodes === 'none' || z <= nodeStart || z >= nodeEnd) return 0
    const i = clamp(Math.floor((z - nodeStart) / nodeSpacing), 0, nodeCount - 1)
    const c = nodeStart + (i + 0.5) * nodeSpacing
    const h = nodeHeight * lerp(1, 0.45, (c - nodeStart) / (nodeEnd - nodeStart))
    if (nodes === 'knobs') return h * swell(z, c, knobWidth)
    return h * (0.65 * swell(z, c, 1.6) + 0.35 * swell(z, c, 6))
  }

  const nodeCentres =
    nodes === 'none'
      ? []
      : Array.from({ length: nodeCount }, (_, i) => nodeStart + (i + 0.5) * nodeSpacing)

  // Bands go in the gaps between bumps (there are nodeCount + 1), or else spread up the lower shaft.
  const bandCount = BAND_COUNTS[p.bands as string] ?? 0
  const bandCentres = Array.from(
    { length: nodes === 'none' ? bandCount : Math.min(bandCount, nodeCount + 1) },
    (_, k) =>
      nodes === 'none'
        ? collarEnd + (bodyTo - collarEnd) * (0.1 + 0.2 * k)
        : nodeStart + k * nodeSpacing,
  )

  // A stick: thickest at the butt, a soft swell where the hand goes, then a long natural taper.
  const grownR = (z: number) =>
    lerp(handleMaxR * 1.02, tipR, Math.pow(z / L, 0.75)) * (1 + 0.06 * swell(z / L, 0.12, 0.14))
  const naturalShaftR = (z: number) =>
    grown ? grownR(z) : lerp(shaftBaseR, tipR, (z - collarEnd) / (bodyTo - collarEnd))

  const profile = (z: number): number => {
    if (z <= bodyFrom || z >= bodyTo) return 0
    let r: number
    if (z < H) {
      if (grown) r = grownR(z)
      else {
        r = curve(turnedStyle.body, z / H) * handleMaxR
        for (const b of turnedStyle.beads) r += bead(z, b.t * H, b.w, b.h * handleMaxR)
      }
      if (orb) {
        // A socket the orb sits in, with a lip round it.
        r += bead(z, bodyFrom + 1.6, 1.6, 0.08 * handleMaxR)
        r *= cap(z - bodyFrom, 1.4, 4)
      } else if (endShape === 'ball') {
        // A ball, then a narrow neck before the body resumes.
        const neck = 1 - 0.3 * (1 - smoothstep(2 * ballR, 2 * ballR + 6, z))
        const sphere = z < 2 * ballR ? Math.sqrt(Math.max(0, ballR * ballR - (z - ballR) ** 2)) : 0
        r = z < ballR ? sphere : Math.max(sphere, r * neck)
      } else {
        if (endShape === 'flare') r *= 1 + 0.18 * (1 - smoothstep(0, 0.12 * H, z))
        const capLen = endShape === 'knob' ? r * 0.9 : endShape === 'flare' ? 2.2 : 1.4
        r *= cap(z, capLen, endShape === 'knob' ? 2 : 4)
      }
    } else if (z < collarEnd) {
      const t = (z - H) / collar.length
      r = lerp(handleEndR, shaftBaseR, (1 - Math.cos(Math.PI * t)) / 2)
      for (const b of collar.beads) r += bead(z, H + b.t * collar.length, b.w, b.h)
    } else {
      const u = (z - collarEnd) / (bodyTo - collarEnd)
      const x = clamp((u - taperHold) / (1 - taperHold), 0, 1)
      const taper = branch
        ? naturalShaftR(z)
        : lerp(tipR, shaftBaseR, (1 + Math.cos(Math.PI * x)) / 2)
      r = taper * (1 + nodeSwell(z))
      for (const c of bandCentres) r += bead(z, c, BAND_HALF_WIDTH, BAND_HEIGHT)
      const d = bodyTo - z
      if (crystal) {
        // A cup a little wider than the crystal, which stands in it.
        const cup = crystal.radius * 1.12 * smoothstep(CUP_LENGTH, CUP_LENGTH - 3, d)
        r = Math.max(r, cup) * cap(d, 1.2, 4)
      } else if (tipShape === 'flat') r *= cap(d, 1.2, 4)
      else if (tipShape === 'domed') r *= cap(d, tipR * 1.5, 2)
      else r *= cap(d, tipR * 0.7, 2)
    }
    return Math.max(0, r)
  }

  const grooves: GrooveSet[] = []
  const shaftCarving = branch ? 'none' : (p.shaftCarving as string)
  const shaftReach = p.shaftReach as number
  const handleCarving = grown ? 'none' : (p.handleCarving as string)

  if (handleCarving !== 'none') {
    const from = Math.max(turnedStyle.carve[0] * H, bodyFrom + 3)
    const to = turnedStyle.carve[1] * H
    const len = to - from
    const fade = Math.min(4, 0.15 * len)
    const n = p.handleCarvingCount as number
    // Not too busy: a long shaft carving or big bumps calm the handle down, gradually as they grow.
    const carvingCalm = shaftCarving === 'none' ? 0 : smoothstep(0.5, 0.75, shaftReach)
    const nodeCalm = nodes === 'none' ? 0 : smoothstep(0.3, 0.8, p.nodeSize as number)
    const calm = Math.max(carvingCalm, nodeCalm)
    const depth = lerp(turnedStyle.depth, Math.min(turnedStyle.depth, 0.1), calm)
    const base = {
      from,
      to,
      fadeIn: fade,
      fadeOut: fade,
      count: n,
      depth,
      halfWidth: Math.min((Math.PI / n) * 0.6, 0.4),
    }
    if (handleCarving === 'flats') grooves.push({ ...base, shape: 'flat', twist: 0 })
    if (handleCarving === 'flutes') grooves.push({ ...base, shape: 'round', twist: 0 })
    if (handleCarving === 'spiralFlutes') {
      grooves.push({ ...base, shape: 'round', twist: (p.handleCarvingTwist as number) / len })
    }
    if (handleCarving === 'diamonds') {
      // Two sets of flats spiralling in opposite directions cross into diamonds;
      // enough twist and depth to read as diamonds, not long flats.
      const diamond = { ...base, shape: 'flat' as const, depth: Math.max(depth, 0.16) }
      grooves.push({ ...diamond, twist: 0.75 / len })
      grooves.push({ ...diamond, twist: -0.75 / len })
    }
  }

  if (shaftCarving !== 'none') {
    const shaftLen = bodyTo - collarEnd
    const from = collarEnd
    // Carving fades out fully before the last 8% of the wand.
    const to = Math.min(collarEnd + shaftReach * shaftLen, bodyTo * 0.92)
    const len = to - from
    const tw = p.twistiness as number
    const pitch =
      shaftCarving === 'shortSpiral'
        ? lerp(45, 25, tw)
        : shaftCarving === 'longSpiral'
          ? lerp(120, 60, tw)
          : lerp(160, 80, tw)
    const dir = p.twistDir === 'left' ? -1 : 1
    const fadeIn = Math.min(0.5 * pitch, 0.3 * len)
    const fadeOut = Math.min(pitch, 0.5 * len)
    if (shaftCarving === 'twistedFacets') {
      grooves.push({
        shape: 'flat',
        count: 6,
        depth: 0.11,
        twist: dir / pitch,
        from,
        to,
        fadeIn,
        fadeOut,
        halfWidth: 0,
      })
    } else {
      const n =
        handleCarving === 'diamonds'
          ? Math.min(p.shaftGrooves as number, 2)
          : (p.shaftGrooves as number)
      // Width is an angle around the wand, capped so neighbouring grooves
      // never merge into one.
      const widest = Math.min((Math.PI / n) * 0.9, 0.9)
      grooves.push({
        // Depth is a fraction of the local radius; the default (0.38) gives
        // the original 10%.
        shape: 'round',
        count: n,
        ...(p.spiralStyle === 'raised'
          ? {
              raised: true,
              metal: p.ridgeFinish === 'metal',
              depth: lerp(0.06, 0.2, p.ridgeHeight as number),
            }
          : { depth: lerp(0.05, 0.18, p.shaftGrooveDepth as number) }),
        twist: dir / pitch,
        from,
        to,
        fadeIn,
        fadeOut,
        halfWidth: lerp(0.18, widest, p.shaftGrooveWidth as number),
      })
    }
  }

  const zones: Zone[] = []
  const handleFinish = p.handleFinish as string
  const shaftFinish = p.shaftFinish as string
  const asZone = (finish: string, from: number, to: number) => {
    if (finish !== 'wood') zones.push({ material: finish as Material, from, to })
  }
  asZone(handleFinish, 0, H)
  asZone(shaftFinish, collarEnd, L)
  if (!grown)
    asZone(
      p.collarFinish === 'metal' || handleFinish === 'metal'
        ? 'metal'
        : handleFinish === shaftFinish
          ? handleFinish
          : 'wood',
      H,
      collarEnd,
    )
  for (const c of bandCentres) {
    zones.push({
      material: 'metal',
      from: c - BAND_HALF_WIDTH,
      to: c + BAND_HALF_WIDTH,
      uncarved: true,
    })
  }
  if (p.endCap === 'metal') {
    const capEnd = orb ? bodyFrom + 3.2 : endShape === 'ball' ? 2 * ballR + 1 : style.cap * H
    zones.push({ material: 'metal', from: 0, to: capEnd })
  }
  const metalSettings = usesMetal(p)
  if (crystal && metalSettings)
    zones.push({ material: 'metal', from: bodyTo - CUP_LENGTH, to: bodyTo })

  const shaftSet = grooves.find((g) => g.from >= collarEnd && g.twist !== 0)
  const gemSize = lerp(1.2, 2.4, p.gemSize as number)
  const gems =
    p.gems === 'none'
      ? []
      : placeGems({
          pattern: p.gems as GemPattern,
          count: p.gemCount as number,
          size: gemSize,
          belt: style.belt * H,
          shaft: [collarEnd + 4, collarEnd + 0.62 * (bodyTo - collarEnd)],
          avoid: [
            ...bandCentres.map((c): [number, number] => [c - BAND_HALF_WIDTH, c + BAND_HALF_WIDTH]),
            ...nodeCentres.map((c): [number, number] => {
              const w = nodes === 'knobs' ? 0.5 * knobWidth : 2
              return [c - w, c + w]
            }),
          ],
          spiral: shaftSet
            ? {
                twist: shaftSet.twist,
                from: shaftSet.from,
                // Between round grooves, or in the middle of a flat face.
                offset: shaftSet.shape === 'round' ? Math.PI / shaftSet.count : 0,
              }
            : null,
          twist: (p.twistDir === 'left' ? -1 : 1) / 240,
          radius: profile,
        })

  const where = p.stencilWhere as string
  const stencilStretches: [number, number][] = []
  if (where !== 'shaft' && stencilPlaces(p).includes('handle'))
    stencilStretches.push([
      Math.max(turnedStyle.carve[0] * H, bodyFrom + 3),
      turnedStyle.carve[1] * H,
    ])
  if (where !== 'handle') {
    const shaftLen = bodyTo - collarEnd
    const reach = where === 'all' ? Math.min(0.9 * shaftLen, shaftLen - 12) : 0.45 * shaftLen
    stencilStretches.push([collarEnd + 3, collarEnd + reach])
  }
  const stencil =
    hasStencil(p) && stencilPlaces(p).includes(where)
      ? compileStencil(
          p.stencil as StencilName,
          p.stencilSize as number,
          stencilStretches,
          zones,
          profile,
        )
      : null

  const stainHex = swatchFor('stainColour', p.stainColour as string)
  return {
    lengthMm: L,
    bodyFrom,
    bodyTo,
    handleMm: H,
    handleMaxR,
    shaftBaseR,
    tipR,
    profile,
    grooves,
    stain: {
      colour: p.stainColour === 'none' || !stainHex ? null : srgbToLinear(stainHex),
      strength: p.stainStrength as number,
      reach: p.stainReach as number,
      softness: 0.35,
    },
    wood: p.wood as string,
    zones,
    metal: p.metal as string,
    paint: srgbToLinear(swatchFor('paintColour', p.paintColour as string) ?? '#888888'),
    spell: swatchFor('core', p.core as string) ?? '#ffffff',
    gems,
    crystal,
    orb,
    metalSettings,
    branch: branch ? compileBranch(p, L, collarEnd, grown, profile, shaftBaseR) : null,
    stencil,
  }
}

/** Stencils keep this far clear of metal, mm. */
const STENCIL_METAL_GAP = 0.8
const SHORTEST_BAND = 4

/** Cuts the stretches round any metal, then fits whole tiles into each piece that's left. */
function compileStencil(
  tile: StencilName,
  size: number,
  stretches: [number, number][],
  zones: Zone[],
  profile: (z: number) => number,
): StencilSpec {
  const { aspect, lengthMm, depth } = STENCILS[tile]
  let pieces = stretches
  for (const zone of zones) {
    if (zone.material !== 'metal') continue
    const lo = zone.from - STENCIL_METAL_GAP
    const hi = zone.to + STENCIL_METAL_GAP
    pieces = pieces.flatMap(([from, to]): [number, number][] =>
      hi <= from || lo >= to
        ? [[from, to]]
        : [
            ...(lo > from ? [[from, lo] as [number, number]] : []),
            ...(hi < to ? [[hi, to] as [number, number]] : []),
          ],
    )
  }
  const tileLength = lerp(lengthMm[0], lengthMm[1], size)
  const bands = pieces
    .filter(([from, to]) => to - from >= SHORTEST_BAND)
    .map(([from, to]): StencilBand => {
      let r = 0
      for (let k = 0; k <= 8; k++) r += profile(lerp(from, to, k / 8)) / 9
      return {
        from,
        to,
        length: (to - from) / Math.max(1, Math.round((to - from) / tileLength)),
        around: Math.max(1, Math.round((TAU * r) / (aspect * tileLength))),
      }
    })
  return { tile, depth, bands }
}

/** Relative strengths of the lumps; they sum to 1 so `gnarl` is the most they can move the radius. */
const LUMP_MIX = [0.38, 0.3, 0.21, 0.11]
const LUMPY_MAX = 0.07

/** Seeded from "Which branch" alone, so changing the colour never grows a different branch. */
function compileBranch(
  p: Params,
  L: number,
  collarEnd: number,
  grown: boolean,
  profile: (z: number) => number,
  shaftBaseR: number,
): BranchSpec {
  const rand = seededRandom(9137 + (p.branchSeed as number) * 7919)
  const bowDir = rand() * TAU
  const wiggles = [0, 1, 2].map((i): Wiggle => {
    const freq = 2 + i + rand()
    // Scaled by (2/f)^2 so every wiggle curves equally hard.
    return {
      freq,
      dir: TAU * rand(),
      phase: TAU * rand(),
      amp: (p.wiggle as number) * 0.022 * L * (2 / freq) ** 2,
    }
  })
  const lumps = LUMP_MIX.map((amp, m): Lump => ({
    m,
    k: TAU / lerp([55, 70, 40, 25][m]!, [95, 120, 70, 45][m]!, rand()),
    phase: TAU * rand(),
    amp,
  }))
  const from = grown ? 0 : collarEnd
  const count = p.knots as number
  const knotFrom = grown ? 0.1 * L : collarEnd + 15
  const knotTo = 0.82 * L
  const knots: Knot[] = []
  for (let i = 0; i < count; i++) {
    const z = lerp(knotFrom, knotTo, (i + 0.2 + 0.6 * rand()) / count)
    // Full-size knots below the grip read as blobs.
    const size = lerp(0.45, 1, smoothstep(0.1 * L, 0.3 * L, z))
    knots.push({
      theta: rand() * TAU,
      z,
      height: lerp(0.16, 0.26, rand()) * size,
      width: profile(z) * lerp(0.55, 0.9, rand()) * lerp(0.7, 1, size),
    })
  }
  return {
    bowMm: (p.bend as number) * 0.07 * L,
    bowDir,
    wiggles,
    gnarl: (p.gnarl as number) * LUMPY_MAX,
    lumps,
    from,
    knots,
    bark:
      p.bark === 'patches' || p.bark === 'full'
        ? compileBark(p.bark, p.branchSeed as number, L, grown, shaftBaseR)
        : null,
  }
}

const BARK_THICKNESS = 0.085
/** Roughly how far apart bark's furrows are round the shaft's base, mm. */
const BARK_FURROW_SPACING = 2.4

/** Its own stream from "Which branch", so changing the knots never moves the bark. */
function compileBark(
  cover: BarkCover,
  branchSeed: number,
  L: number,
  grown: boolean,
  shaftBaseR: number,
): BarkSpec {
  const rand = seededRandom(4241 + branchSeed * 6007)
  return {
    cover,
    patchMm: lerp(35, 55, rand()),
    wornTo: grown ? 0.24 * L : 0,
    thickness: BARK_THICKNESS,
    around: 9,
    raggedMm: 7,
    furrows: Math.max(6, Math.round((TAU * shaftBaseR) / BARK_FURROW_SPACING)),
    furrowMm: lerp(26, 40, rand()),
    seed: Math.floor(rand() * 1e6),
  }
}
