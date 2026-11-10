import type { Params } from '../engine/schema.ts'
import { shopNumber } from '../items/shopNumber.ts'
import type { GemCut } from '../wand/gems.ts'
import type { StencilName } from '../wand/stencils.ts'
import { type Curve, sample } from './curve.ts'
import {
  baseWidthMm,
  bladeLengthMm,
  clamp,
  collarMm,
  type Family,
  familyOf,
  type FamilyDef,
  gripLengthMm,
  guardDepthMm,
  inBand,
  lerp,
  pommelDiameterMm,
  pommelLengthMm,
} from './families.ts'
import { hasGroove, hasGems, hasRunes, hasWaves, isCross, swordSwatchFor } from './swordSchema.ts'

// Compiles kid-level choices into a geometric spec. All lengths are mm; z runs
// from 0 at the pommel's end to lengthMm at the tip. Curves run u = 0..1 from the
// blade's shoulder to its tip (the grip's: pommel side to guard side).

export interface Fuller {
  from: number
  to: number
  /** Centre across the blade, as a fraction of the local width from the edge (0.5 is the middle). */
  offset: number
  /** Half its width, as a fraction of the local width. */
  halfWidth: number
  /** Depth as a fraction of the local half-thickness. */
  depth: number
  /** Run-out at the tip end, mm. */
  fade: number
}

export interface SwordSpec {
  lengthMm: number
  family: Family
  blade: {
    /** Shoulder and tip, z. */
    from: number
    to: number
    edges: 'double' | 'single'
    /** Edge side, from the centre line, mm; profile and tip shape live here. */
    halfWidth: Curve
    /** Single-edged only: the spine side, mm. */
    backWidth: Curve | null
    /** Full thickness, mm: the distal taper. */
    thickness: Curve
    section: 'lenticular' | 'diamond' | 'wedge'
    /** Katana ridge line, as a fraction of the width from the edge. */
    ridgeAt: number | null
    /** Flared profile: the back is sharpened from this u. */
    backBevelFrom: number | null
    tip: string
    /** Where the tip's closing run starts, u (the Katana's point line). */
    tipFrom: number
    /** Rise of a flat face across its width, mm. */
    crown: number
    /** Width of the cutting bevel, mm: what catches the glint. */
    edgeBevel: number
    /** Thickness left at the very edge, mm. */
    edgeFlat: number
    /** Unsharpened stretch past the guard, mm. */
    ricasso: number
    fullers: Fuller[]
    /** Flame waves: amplitude as a fraction of the local width, from and to in z. */
    wave: { amp: number; lengthMm: number; count: number; from: number; to: number } | null
    /** In the blade plane, toward the spine. */
    curve: { depthMm: number; peak: number } | null
  }
  guard: {
    style: string
    from: number
    to: number
    /** End to end, or the diameter of a disc, dome or cup. */
    span: number
    /** Bar or plate thickness, mm. */
    thickness: number
    /** How far the ends reach along the sword, mm: positive toward the blade, negative toward the pommel. */
    sweep: number
    ends: string
    discShape: string | null
    /** Langet length down the blade, mm; 0 for none. */
    langets: number
  }
  collar: { from: number; to: number } | null
  grip: {
    from: number
    to: number
    radius: Curve
    /** Thickness over width of the grip's section. */
    oval: number
    wrap: 'leather' | 'cord' | 'wire' | 'wood' | 'ribbed' | 'diamond'
    /** Wrap or rib pitch, mm; 0 for a smooth grip. */
    pitchMm: number
    /** Riser positions under leather, u. */
    risers: number[]
  }
  pommel: { style: string; from: number; to: number; radius: number; facets: number }
  gems: { at: 'pommel' | 'guard'; cut: GemCut; radius: number }[]
  runes: {
    from: number
    to: number
    halfHeight: number
    where: 'fuller' | 'flat'
    glyphs: number
    seed: number
    /** sRGB hex. */
    colour: string
  } | null
  engraving: { tile: StencilName; from: number; to: number; halfHeight: number } | null
  finish: {
    steel: string
    fittings: string
    pattern: 'plain' | 'watered' | 'temper'
    wear: number
    /** Linear RGB. */
    gripColour: [number, number, number]
  }
  /** The gems' light and stone as sRGB hex; null without gems. */
  glow: { colour: string; body: string } | null
  /** Where a hand holds it, as a fraction of lengthMm. */
  gripAt: number
}

type Side = { run: number; shape: (t: number) => number }
/** Closing run of the width curve per tip: length in widths at the tip, and its shape. */
const TIPS: Record<string, { edge: Side; back?: Side }> = {
  sharp: { edge: { run: 1.1, shape: (t) => 1 - t ** 1.6 } },
  longPoint: { edge: { run: 2.2, shape: (t) => 1 - t ** 1.25 } },
  rounded: { edge: { run: 0.5, shape: (t) => Math.sqrt(1 - t * t) } },
  curvedPoint: {
    edge: { run: 0.8, shape: (t) => 1 - t ** 1.2 },
    back: { run: 1.6, shape: (t) => 1 - t * t },
  },
  spear: { edge: { run: 1.3, shape: (t) => 1 - t ** 1.3 } },
  clipped: {
    edge: { run: 0.9, shape: (t) => 1 - t * t },
    back: { run: 2.2, shape: (t) => 1 - t },
  },
  kissaki: { edge: { run: 0, shape: (t) => 1 - t * t }, back: { run: 0, shape: (t) => 1 - t } },
}
const TIP_SAMPLES = 10
const BODY_STEP = 0.05
const MAX_TIP_RUN = 0.3

// Estimates, tune at G1: the hilt's sections and pitches.
/** Bar or plate thickness at a 50 mm blade, mm. */
const GUARD_BAR: Record<string, number> = {
  straight: 11,
  curved: 11,
  sCurve: 10,
  winged: 9,
  dome: 3,
  knuckleBow: 9,
  disc: 6,
  swept: 8,
  cup: 2.5,
}
const dyed = (p: Params) => swordSwatchFor('gripColour', p.gripColour as string) ?? '#7a4a2a'
/** Wood is walnut, ribs are bone, wire is the fittings metal. */
const WRAPS: Record<string, { pitch: (gripMm: number) => number; colour: (p: Params) => string }> =
  {
    leather: { pitch: () => 0, colour: dyed },
    cord: { pitch: () => 4.5, colour: dyed },
    wire: {
      pitch: () => 2.2,
      colour: (p) => swordSwatchFor('fittings', p.fittings as string) ?? '#9a9da1',
    },
    wood: { pitch: () => 0, colour: () => '#5b3a24' },
    ribbed: { pitch: (g) => g / 4, colour: () => '#e8e0cf' },
    diamond: { pitch: () => 32, colour: dyed },
  }
const GRIP_SHAPES: Record<string, Curve> = {
  straight: [
    [0, 1],
    [1, 1],
  ],
  swelling: [
    [0, 0.92],
    [0.5, 1.1],
    [1, 0.92],
  ],
  waisted: [
    [0, 1.06],
    [0.5, 0.9],
    [1, 1.06],
  ],
}
const POMMEL_FACETS: Record<string, number> = { egg: 8, block: 4, lobed: 3, fishtail: 2 }
/** A pommel's flat face or top, as a fraction of its diameter, where a gem sits. */
const POMMEL_FACE = 0.7
const FULLERS: Record<string, { count: number; width: [number, number]; depth: number }> = {
  groove1: { count: 1, width: [0.4, 0.25], depth: 0.3 },
  groove2: { count: 2, width: [0.22, 0.15], depth: 0.25 },
  groove3: { count: 3, width: [0.15, 0.1], depth: 0.22 },
  ridgeGroove: { count: 1, width: [0.24, 0.18], depth: 0.3 },
}
const STENCIL_TILES: string[] = ['vine', 'knotwork', 'scales', 'dots']

/** The stone is its glow's colour at a quarter of the light, unless it says otherwise (as the wand's). */
const GEM_COLOURS: Record<string, { glow: string; body?: string }> = {
  amethyst: { glow: '#c38bff' },
  emerald: { glow: '#4dff98' },
  ruby: { glow: '#ff2440' },
  sapphire: { glow: '#5a86ff' },
  citrine: { glow: '#ff901f' },
  clear: { glow: '#eaf2ff', body: '#4a5058' },
  smoky: { glow: '#a8703f', body: '#1c1612' },
}

function srgbToLinear(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)]
}

function linearToSrgb([r, g, b]: [number, number, number]): string {
  const c = (v: number) => {
    const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
    return Math.round(clamp(s, 0, 1) * 255)
  }
  return `#${((c(r) << 16) | (c(g) << 8) | c(b)).toString(16).padStart(6, '0')}`
}

/** Cosine bump: 1 at c, easing to 0 at w either side. */
const bump = (u: number, c: number, w: number) => {
  const x = (u - c) / w
  return Math.abs(x) < 1 ? (1 + Math.cos(Math.PI * x)) / 2 : 0
}
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const LEAF_PEAK = 1.15

/** The blade's outline before the tip, as fractions of the base half-width, per side. */
function bodyShape(
  p: Params,
  ratio: number,
): { edge: (u: number) => number; back: (u: number) => number } {
  const line = (u: number) => lerp(1, ratio, u)
  switch (p.profile) {
    case 'leaf': {
      const leaf: Curve = [
        [0, 1],
        [0.25, 0.97],
        [0.65, LEAF_PEAK],
        [1, Math.min(ratio, LEAF_PEAK)],
      ]
      return { edge: (u) => sample(leaf, u), back: (u) => sample(leaf, u) }
    }
    case 'waisted': {
      const waisted = (u: number) => line(u) * (1 - 0.08 * bump(u, 0.45, 0.35))
      return { edge: waisted, back: waisted }
    }
    case 'flared':
      return { edge: line, back: (u) => line(u) * (1 + 0.3 * smoothstep(0.7, 0.9, u)) }
    default:
      return { edge: line, back: line }
  }
}

function sideCurve(body: (u: number) => number, halfBase: number, from: number, side: Side): Curve {
  const curve: Curve = []
  for (let u = 0; u < from - 1e-9; u += BODY_STEP) curve.push([u, body(u) * halfBase])
  const start = body(from) * halfBase
  for (let i = 0; i <= TIP_SAMPLES; i++) {
    const t = Math.sin((Math.PI / 2) * (i / TIP_SAMPLES))
    curve.push([lerp(from, 1, t), i === TIP_SAMPLES ? 0 : start * side.shape(t)])
  }
  return curve
}

function outline(p: Params, f: FamilyDef, B: number, base: number) {
  const ratio = lerp(f.tipRatio[0], f.tipRatio[1], p.taper as number)
  const body = bodyShape(p, ratio)
  const tip = TIPS[p.tip as string] ?? TIPS.sharp!
  const widthAtTip = (base / 2) * (body.edge(1) + body.back(1))
  const runOf = (side: Side) =>
    p.tip === 'kissaki'
      ? lerp(25, 60, p.kissakiSize as number) / B
      : Math.min((side.run * widthAtTip) / B, MAX_TIP_RUN)
  const edgeFrom = 1 - runOf(tip.edge)
  const backSide = tip.back ?? tip.edge
  const backFrom = 1 - runOf(backSide)
  const halfWidth = sideCurve(body.edge, base / 2, edgeFrom, tip.edge)
  const backWidth = f.edges === 'single' ? sideCurve(body.back, base / 2, backFrom, backSide) : null
  return { halfWidth, backWidth, tipFrom: Math.min(edgeFrom, backFrom) }
}

function fullersFor(
  p: Params,
  f: FamilyDef,
  [bladeFrom, B]: [number, number],
  [start, end]: [number, number],
  ridgeAt: number | null,
): Fuller[] {
  const def = FULLERS[p.middle as string]
  if (!def) return []
  let width = lerp(def.width[0], def.width[1], p.bladeWidth as number)
  let offsets: number[]
  if (ridgeAt !== null) {
    width = Math.min(width, (1 - ridgeAt) * 0.6)
    offsets = [(ridgeAt + 1) / 2]
  } else if (f.edges === 'single') offsets = [0.7]
  else {
    const step = width * 1.5
    offsets =
      def.count === 1
        ? [0.5]
        : def.count === 2
          ? [0.5 - step / 2, 0.5 + step / 2]
          : [0.5 - step, 0.5, 0.5 + step]
  }
  const want = bladeFrom + lerp(0.25, 0.85, p.grooveLength as number) * B
  const to = clamp(want, Math.min(start + 70, end), end)
  const fade = clamp(0.1 * (to - start), 30, (to - start) / 2)
  return offsets.map((offset) => ({
    from: start,
    to,
    offset,
    halfWidth: width / 2,
    depth: def.depth,
    fade,
  }))
}

const seedOf = (p: Params) =>
  Number(
    shopNumber({
      family: p.family!,
      bladeLength: p.bladeLength!,
      bladeWidth: p.bladeWidth!,
      middle: p.middle!,
      runes: p.runes!,
    }),
  )

export function compileSword(p: Params): SwordSpec {
  const f = familyOf(p)
  const family = (p.family as Family) ?? 'knight'
  const B = bladeLengthMm(p)
  const base = baseWidthMm(p)
  const G = gripLengthMm(p)
  const pommelD = pommelDiameterMm(p)
  const P = pommelLengthMm(p)
  const guardFrom = P + G
  const bladeFrom = guardFrom + guardDepthMm(p)
  const lengthMm = bladeFrom + B
  const collar = collarMm(p)
  const bw = p.bladeWidth as number

  const { halfWidth, backWidth, tipFrom } = outline(p, f, B, base)
  const widthAt = (z: number) => {
    const u = (z - bladeFrom) / B
    return sample(halfWidth, u) + sample(backWidth ?? halfWidth, u)
  }

  const katana = family === 'katana'
  const single = f.edges === 'single'
  const ridgeAt = katana ? lerp(0.55, 0.65, bw) : null
  const section = single ? 'wedge' : p.middle === 'ridge' ? 'diamond' : 'lenticular'

  const baseThickness = inBand(f.thickness, bw)
  const tipThickness = katana ? 4.5 : lerp(2, 3, bw)
  const thickness: Curve = [
    [0, baseThickness],
    [0.5, lerp(baseThickness, tipThickness, 0.55)],
    [tipFrom, tipThickness],
    [1, tipThickness * 0.5],
  ]

  const ricasso =
    p.ricasso === 'short' ? Math.max(30, 0.05 * B) : p.ricasso === 'long' ? 0.14 * B : 0
  const featureStart = bladeFrom + Math.max(ricasso, collar) + 5
  const featureEnd = bladeFrom + Math.min(0.85 * B, tipFrom * B - 10)
  const fullers = hasGroove(p)
    ? fullersFor(p, f, [bladeFrom, B], [featureStart, featureEnd], ridgeAt)
    : []

  let wave: SwordSpec['blade']['wave'] = null
  if (hasWaves(p) && f.waves) {
    const from = bladeFrom + ricasso + 10
    const to = bladeFrom + Math.min(0.88 * B, tipFrom * B - 5)
    const count = clamp(
      Math.round(p.waveCount as number),
      1,
      Math.max(1, Math.floor((to - from) / 60)),
    )
    wave = { amp: 0.07, lengthMm: (to - from) / count, count, from, to }
  }

  const curve =
    single && f.curvePeak
      ? {
          depthMm: inBand(f.sagitta, p.curve as number),
          peak: lerp(f.curvePeak[0], f.curvePeak[1], p.curve as number),
        }
      : null

  const style = p.guard as string
  const gw = p.guardWidth as number
  let span: number
  if (style === 'disc' || style === 'dome' || style === 'cup') {
    const band = (style === 'disc' ? f.discSpan : f.domeSpan) ?? f.guardSpan
    span = clamp(base * lerp(2.2, 2.8, gw), band[0], band[1])
  } else {
    span = Math.max(clamp(base * lerp(3.5, 5.5, gw), f.guardSpan[0], f.guardSpan[1]), base + 60)
  }
  const half = span / 2
  const sweep =
    style === 'curved'
      ? lerp(0.1, 0.35, p.guardBend as number) * half
      : style === 'sCurve'
        ? 0.18 * half
        : style === 'winged'
          ? 0.12 * half
          : style === 'swept'
            ? 45
            : style === 'knuckleBow'
              ? -G
              : 0
  const langets =
    !f.langets || p.langets === 'none'
      ? 0
      : p.langets === 'short'
        ? Math.max(30, 0.04 * B)
        : Math.max(55, 0.08 * B)
  const barScale = ['dome', 'cup', 'disc'].includes(style) ? 1 : clamp(base / 50, 0.75, 1.25)
  const guard: SwordSpec['guard'] = {
    style,
    from: guardFrom,
    to: bladeFrom,
    span,
    thickness: (GUARD_BAR[style] ?? 10) * barScale,
    sweep,
    ends: isCross(p) ? (p.guardEnds as string) : 'plain',
    discShape: style === 'disc' ? (p.discShape as string) : null,
    langets,
  }

  const wrapName = p.wrap as SwordSpec['grip']['wrap']
  const wrap = WRAPS[wrapName] ?? WRAPS.leather!
  const r = f.gripRadius
  const shape = GRIP_SHAPES[p.gripShape as string] ?? GRIP_SHAPES.straight!
  const riserCount = clamp(Math.round(G / 45) - 1, 1, 5)
  const grip: SwordSpec['grip'] = {
    from: P,
    to: guardFrom,
    radius: shape.map(([u, k]) => [u, k * r]),
    oval: katana ? 0.78 : 0.82,
    wrap: wrapName,
    pitchMm: wrap.pitch(G),
    risers:
      wrapName === 'leather'
        ? Array.from({ length: riserCount }, (_, i) => (i + 1) / (riserCount + 1))
        : [],
  }
  const gripHex = wrap.colour(p)

  const pommel = {
    style: p.pommel as string,
    from: 0,
    to: P,
    radius: pommelD / 2,
    facets: POMMEL_FACETS[p.pommel as string] ?? 0,
  }

  const cut = p.gemCut as GemCut
  const gems: SwordSpec['gems'] = []
  if (p.gems === 'pommel' || p.gems === 'both')
    gems.push({ at: 'pommel', cut, radius: (0.45 * pommelD * POMMEL_FACE) / 2 })
  if (p.gems === 'guard' || p.gems === 'both') {
    const block = style === 'disc' ? 0.5 * ((span - base) / 2) : 0.8 * base
    gems.push({ at: 'guard', cut, radius: (0.7 * block) / 2 })
  }

  const engraving: SwordSpec['engraving'] = STENCIL_TILES.includes(p.engraving as string)
    ? {
        tile: p.engraving as StencilName,
        from: bladeFrom + collar + 4,
        to: bladeFrom + collar + 4 + clamp(0.1 * B, 40, 110),
        halfHeight: 0.32 * base,
      }
    : null

  const runeHex = swordSwatchFor('runeColour', p.runeColour as string) ?? '#8fe3ff'
  let runes: SwordSpec['runes'] = null
  if (hasRunes(p)) {
    const seed = seedOf(p)
    const run = lerp(0.25, 0.4, hasGroove(p) ? (p.grooveLength as number) : 0.5) * B
    if (p.runes === 'groove' && fullers.length > 0) {
      const fuller = fullers.reduce((a, b) =>
        Math.abs(b.offset - 0.5) < Math.abs(a.offset - 0.5) ? b : a,
      )
      const from = Math.max(bladeFrom + 40, fuller.from)
      const to = Math.max(from + 20, Math.min(from + run, fuller.to - fuller.fade))
      const halfHeight = (0.65 * 2 * fuller.halfWidth * widthAt(from)) / 2
      runes = {
        from,
        to,
        halfHeight,
        where: 'fuller',
        glyphs: glyphsIn(to - from, halfHeight),
        seed,
        colour: runeHex,
      }
    } else if (p.runes === 'centre') {
      const from = bladeFrom + ricasso + 40
      const halfHeight = 0.18 * base
      runes = {
        from,
        to: from + run,
        halfHeight,
        where: 'flat',
        glyphs: glyphsIn(run, halfHeight),
        seed,
        colour: runeHex,
      }
    } else {
      const glyphs = 3 + (seed % 2)
      const halfHeight = 0.2 * base
      const from = Math.max(bladeFrom + collar + 15, (engraving?.to ?? 0) + 8)
      runes = {
        from,
        to: from + glyphs * 2 * halfHeight * 1.35,
        halfHeight,
        where: 'flat',
        glyphs,
        seed,
        colour: runeHex,
      }
    }
  }

  let glow: SwordSpec['glow'] = null
  if (hasGems(p)) {
    const named = GEM_COLOURS[p.gemColour as string]
    const colour = named?.glow ?? runeHex
    const body =
      named?.body ??
      linearToSrgb(srgbToLinear(colour).map((v) => v * 0.25) as [number, number, number])
    glow = { colour, body }
  }

  return {
    lengthMm,
    family,
    blade: {
      from: bladeFrom,
      to: lengthMm,
      edges: f.edges,
      halfWidth,
      backWidth,
      thickness,
      section,
      ridgeAt,
      backBevelFrom: p.profile === 'flared' ? 0.7 : null,
      tip: p.tip as string,
      tipFrom,
      crown: lerp(0.2, 0.5, bw),
      edgeBevel: lerp(2, 4, clamp((base - 20) / 45, 0, 1)),
      edgeFlat: 0.3,
      ricasso,
      fullers,
      wave,
      curve,
    },
    guard,
    collar: collar > 0 ? { from: bladeFrom, to: bladeFrom + collar } : null,
    grip,
    pommel,
    gems,
    runes,
    engraving,
    finish: {
      steel: p.steel as string,
      fittings: p.fittings as string,
      pattern: p.pattern as SwordSpec['finish']['pattern'],
      wear: p.wear as number,
      gripColour: srgbToLinear(gripHex),
    },
    glow,
    gripAt: (P + G / 2) / lengthMm,
  }
}

/** Glyphs that fit a run, each a glyph high with 35% spacing. */
const glyphsIn = (runMm: number, halfHeight: number) =>
  Math.max(1, Math.floor(runMm / (2 * halfHeight * 1.35)))
