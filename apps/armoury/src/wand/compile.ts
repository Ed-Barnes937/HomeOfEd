import type { Params } from '../engine/schema.ts'
import { swatchFor } from './wandSchema.ts'

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

export interface WandSpec {
  lengthMm: number
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

const BAND_COUNTS: Record<string, number> = { none: 0, one: 1, two: 2, three: 3 }
const BAND_HALF_WIDTH = 1.5
const BAND_HEIGHT = 0.45

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
  const style = HANDLE_STYLES[p.handleStyle as string] ?? HANDLE_STYLES.plain!
  const collar = COLLARS[p.collarStyle as string] ?? COLLARS.bead!

  // Coupling, calibrated on the measured 12" reference wand: handle 15mm,
  // shaft base about 11mm, tip about 10mm.
  const handleMaxR = (clamp(L * 0.049, 13, 19) * (p.thickness as number)) / 2
  const shaftBaseR = clamp(handleMaxR * 2 - 4, 9, 14) / 2
  const tipR = shaftBaseR * (1 - 0.45 * (p.pointy as number))
  const taperHold = clamp(0.25 + (lengthCm - 28) * 0.015, 0, 0.6)

  const H = style.ratio * L
  const collarEnd = H + collar.length
  const handleEndR = curve(style.body, 1) * handleMaxR

  const endShape = p.endShape as string
  const ballR = handleMaxR * 0.95
  const tipShape = p.tipShape as string

  const nodes = p.nodes as string
  const nodeCount = p.nodeCount as number
  const nodeStart = collarEnd + 6
  const nodeEnd = L * 0.86
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

  // Bands go in the gaps between bumps, or else spread up the lower shaft.
  const bandCount = BAND_COUNTS[p.bands as string] ?? 0
  const bandCentres = Array.from({ length: bandCount }, (_, k) =>
    nodes === 'none' ? collarEnd + (L - collarEnd) * (0.1 + 0.2 * k) : nodeStart + k * nodeSpacing,
  ).filter((c) => c <= nodeEnd)

  const profile = (z: number): number => {
    if (z <= 0 || z >= L) return 0
    let r: number
    if (z < H) {
      const t = z / H
      r = curve(style.body, t) * handleMaxR
      for (const b of style.beads) r += bead(z, b.t * H, b.w, b.h * handleMaxR)
      if (endShape === 'flare') r *= 1 + 0.18 * (1 - smoothstep(0, 0.12 * H, z))
      if (endShape === 'ball') {
        // A ball, then a narrow neck before the body resumes.
        const neck = 1 - 0.3 * (1 - smoothstep(2 * ballR, 2 * ballR + 6, z))
        const sphere = z < 2 * ballR ? Math.sqrt(Math.max(0, ballR * ballR - (z - ballR) ** 2)) : 0
        r = z < ballR ? sphere : Math.max(sphere, r * neck)
      } else {
        const capLen = endShape === 'knob' ? r * 0.9 : endShape === 'flare' ? 2.2 : 1.4
        r *= cap(z, capLen, endShape === 'knob' ? 2 : 4)
      }
    } else if (z < collarEnd) {
      const t = (z - H) / collar.length
      r = lerp(handleEndR, shaftBaseR, (1 - Math.cos(Math.PI * t)) / 2)
      for (const b of collar.beads) r += bead(z, H + b.t * collar.length, b.w, b.h)
    } else {
      const u = (z - collarEnd) / (L - collarEnd)
      const x = clamp((u - taperHold) / (1 - taperHold), 0, 1)
      r = lerp(tipR, shaftBaseR, (1 + Math.cos(Math.PI * x)) / 2) * (1 + nodeSwell(z))
      for (const c of bandCentres) r += bead(z, c, BAND_HALF_WIDTH, BAND_HEIGHT)
      const d = L - z
      if (tipShape === 'flat') r *= cap(d, 1.2, 4)
      else if (tipShape === 'domed') r *= cap(d, tipR * 1.5, 2)
      else r *= cap(d, tipR * 0.7, 2)
    }
    return Math.max(0, r)
  }

  const grooves: GrooveSet[] = []
  const shaftCarving = p.shaftCarving as string
  const shaftReach = p.shaftReach as number
  const handleCarving = p.handleCarving as string

  if (handleCarving !== 'none') {
    const from = style.carve[0] * H
    const to = style.carve[1] * H
    const len = to - from
    const fade = Math.min(4, 0.15 * len)
    const n = p.handleCarvingCount as number
    // Not too busy: a long shaft carving or big bumps calm the handle down, gradually as they grow.
    const carvingCalm = shaftCarving === 'none' ? 0 : smoothstep(0.5, 0.75, shaftReach)
    const nodeCalm = nodes === 'none' ? 0 : smoothstep(0.3, 0.8, p.nodeSize as number)
    const calm = Math.max(carvingCalm, nodeCalm)
    const depth = lerp(style.depth, Math.min(style.depth, 0.1), calm)
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
    const shaftLen = L - collarEnd
    const from = collarEnd
    // Carving fades out fully before the last 8% of the wand.
    const to = Math.min(collarEnd + shaftReach * shaftLen, L * 0.92)
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
  asZone(
    p.collarFinish === 'metal' ? 'metal' : handleFinish === shaftFinish ? handleFinish : 'wood',
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
    const capEnd = endShape === 'ball' ? 2 * ballR + 1 : style.cap * H
    zones.push({ material: 'metal', from: 0, to: capEnd })
  }

  const stainHex = swatchFor('stainColour', p.stainColour as string)
  return {
    lengthMm: L,
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
  }
}
