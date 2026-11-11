import type { Params } from '../engine/schema.ts'
import { gemLight, srgbToLinear } from '../items/colour.ts'
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
  type Fittings,
  GRIP_SHAPES,
  type GuardStyle,
  type PommelStyle,
  type Steel,
  type Tip,
  type Wrap,
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
  /**
   * Pommel + grip + guard + blade along one straight axis. Every z here is the sword before
   * its curve, and the bend keeps the blade's length along its curve (arc length); after it and the rotation that puts pommel and tip on the axis, a curved
   * sword's drawn pommel-to-tip distance is shorter (under 0.5% on a Katana, up to about 5% on
   * the deepest Sabre).
   */
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
    tip: Tip
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
    /**
     * In the blade plane, toward the spine, with zero offset and slope at the shoulder. depthMm
     * is the sagitta: the largest distance from the bent centre line to the straight line from
     * the shoulder to the bent tip; peak is the u where it falls.
     */
    curve: { depthMm: number; peak: number } | null
  }
  guard: {
    style: GuardStyle
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
    wrap: Wrap
    /** Wrap or rib pitch, mm; 0 for a smooth grip. */
    pitchMm: number
    /** Riser positions under leather, u. */
    risers: number[]
  }
  pommel: { style: PommelStyle; from: number; to: number; radius: number; facets: number }
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
    steel: Steel
    fittings: Fittings
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
/**
 * A closing run whose slope eases in from zero over the first `a` of it (zero curvature too),
 * then holds: tangent to the body where the point starts, ogival at a = 1, near-straight-sided
 * when a is small.
 */
const ogive = (a: number) => {
  const eased = (t: number) => {
    if (t >= a) return a / 2 + (t - a)
    const x = t / a
    return a * (x ** 3 - x ** 4 / 2)
  }
  const total = eased(1)
  return (t: number) => 1 - eased(t) / total
}
/** Closing run of the width curve per tip: length in widths at the tip, and its shape. */
const TIPS: Record<string, { edge: Side; back?: Side }> = {
  sharp: { edge: { run: 1.3, shape: ogive(1) } },
  longPoint: { edge: { run: 2.2, shape: ogive(0.45) } },
  // Square to the axis at the end, so the two edges meet in one arc with no nib; eased in where it starts.
  rounded: { edge: { run: 0.55, shape: (t) => Math.sqrt(Math.max(0, 1 - t ** 2.2)) } },
  curvedPoint: {
    edge: { run: 1.6, shape: ogive(1) },
    back: { run: 0.8, shape: ogive(0.6) },
  },
  spear: { edge: { run: 1.3, shape: ogive(0.6) } },
  // The back is cut away in a concave sweep from a corner; the edge rises to meet it.
  clipped: {
    edge: { run: 2.2, shape: ogive(1) },
    back: { run: 1.1, shape: (t) => (1 - t) ** 1.6 },
  },
  // The edge sweeps round in a convex belly; the back runs on almost straight, over a longer run.
  kissaki: { edge: { run: 0, shape: ogive(1) }, back: { run: 0, shape: ogive(0.2) } },
}
const TIP_SAMPLES = 32
/** How far a blade's width, from slimmest to broadest in its band, moves the guard size. */
const GUARD_BASE_NUDGE = 0.2
/** The least a bar guard's span moves across the Guard size slider, mm. */
const MIN_GUARD_RANGE = 20
/** A disc, dome or cup at least this many base widths across, so it never reads as a collar. */
const PLATE_OVER_BASE = 1.4
const MIN_PLATE_RANGE = 17
const BODY_STEP = 0.05
const MAX_TIP_RUN = 0.3
/** A point is never shorter than this, so even a needle tip eases in. */
const MIN_TIP_RUN_MM = 22

// Estimates, tune at G1: the hilt's sections and pitches.
/** Bar or plate thickness at a 50 mm blade, mm. */
const GUARD_BAR: Record<string, number> = {
  straight: 11,
  curved: 11,
  sCurve: 10,
  winged: 11,
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
const POMMEL_FACETS: Record<string, number> = { egg: 8, block: 4, lobed: 3, fishtail: 2 }
/** A pommel's flat face or top, as a fraction of its diameter, where a gem sits. */
const POMMEL_FACE = 0.7
/** A guard's stone across, over its seat (a disc's ring or a cross's block): small, as a set stone is. */
const GUARD_GEM = 0.5
/** Runes on a flat or a ridge: half their height over the blade's base width (tuned at G3). */
const RUNE_FLAT = 0.12
const FULLERS: Record<string, { count: number; width: [number, number]; depth: number }> = {
  groove1: { count: 1, width: [0.4, 0.25], depth: 0.3 },
  groove2: { count: 2, width: [0.22, 0.15], depth: 0.25 },
  groove3: { count: 3, width: [0.15, 0.1], depth: 0.22 },
  ridgeGroove: { count: 1, width: [0.24, 0.18], depth: 0.3 },
}
const STENCIL_TILES: string[] = ['vine']

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
/** Flame waves: each edge moves this share of the local width, never more than WAVE_MAX_MM (blade.ts). */
const WAVE_AMP = 0.06
/** The Katana's back closes over this many times the point's length. */
const KISSAKI_BACK_RUN = 1.8

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
  // Knots close together either side of where the point starts and at its end, so the
  // interpolation follows the shapes; the body's own taper carries on under the closing shape.
  const tAt = (i: number) => (1 - Math.cos((Math.PI * i) / TIP_SAMPLES)) / 2
  const run = 1 - from
  const nearStart = Array.from(
    { length: TIP_SAMPLES / 2 },
    (_, i) => from - tAt(TIP_SAMPLES / 2 - i) * run,
  )
  for (let u = 0; u < nearStart[0]! - 1e-9; u += BODY_STEP) curve.push([u, body(u) * halfBase])
  for (const u of nearStart) if (u > 0) curve.push([u, body(u) * halfBase])
  for (let i = 0; i <= TIP_SAMPLES; i++) {
    const t = tAt(i)
    const u = lerp(from, 1, t)
    curve.push([u, i === TIP_SAMPLES ? 0 : body(u) * halfBase * side.shape(t)])
  }
  return curve
}

function outline(p: Params, f: FamilyDef, B: number, base: number) {
  const ratio = lerp(f.tipRatio[0], f.tipRatio[1], p.taper as number)
  const body = bodyShape(p, ratio)
  const tip = TIPS[p.tip as string] ?? TIPS.sharp!
  const widthAt = (u: number) => (base / 2) * (body.edge(u) + body.back(u))
  // The run is measured in widths where it starts, which depends on the run: settle it in a few steps.
  const startOf = (side: Side) => {
    if (p.tip === 'kissaki')
      return (
        1 - (side === tip.back ? KISSAKI_BACK_RUN : 1) * (lerp(25, 60, p.kissakiSize as number) / B)
      )
    let from = 1
    for (let i = 0; i < 4; i++)
      from = 1 - Math.min(Math.max(side.run * widthAt(from), MIN_TIP_RUN_MM) / B, MAX_TIP_RUN)
    return from
  }
  const edgeFrom = startOf(tip.edge)
  const backSide = tip.back ?? tip.edge
  const backFrom = startOf(backSide)
  const halfWidth = sideCurve(body.edge, base / 2, edgeFrom, tip.edge)
  const backWidth = f.edges === 'single' ? sideCurve(body.back, base / 2, backFrom, backSide) : null
  // The Katana's point section, and its yokote, start where the edge turns.
  const tipFrom = p.tip === 'kissaki' ? edgeFrom : Math.min(edgeFrom, backFrom)
  return { halfWidth, backWidth, tipFrom }
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
  const family = p.family as Family
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
  const ridgeAt = katana ? lerp(0.62, 0.7, bw) : null
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
  const engraving: SwordSpec['engraving'] = STENCIL_TILES.includes(p.engraving as string)
    ? {
        tile: p.engraving as StencilName,
        from: bladeFrom + collar + 4,
        to: bladeFrom + collar + 4 + clamp(0.1 * B, 40, 110),
        halfHeight: 0.32 * base,
      }
    : null
  const featureStart = Math.max(bladeFrom + Math.max(ricasso, collar), engraving?.to ?? 0) + 5
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
    wave = { amp: WAVE_AMP, lengthMm: (to - from) / count, count, from, to }
  }

  const curve =
    single && f.curvePeak
      ? {
          depthMm: inBand(f.sagitta, p.curve as number),
          peak: lerp(f.curvePeak[0], f.curvePeak[1], p.curve as number),
        }
      : null

  const style = p.guard as GuardStyle
  const baseInBand = (base - f.baseWidth[0]) / (f.baseWidth[1] - f.baseWidth[0])
  const gw = clamp((p.guardWidth as number) + GUARD_BASE_NUDGE * (baseInBand - 0.5), 0, 1)
  let span: number
  if (style === 'disc' || style === 'dome' || style === 'cup') {
    const band = (style === 'disc' ? f.discSpan : f.domeSpan) ?? f.guardSpan
    const lo = Math.max(band[0], PLATE_OVER_BASE * base)
    span = lerp(lo, Math.max(band[1], lo + MIN_PLATE_RANGE), gw)
  } else {
    const lo = Math.max(f.guardSpan[0], base + 60)
    span = lerp(lo, Math.max(f.guardSpan[1], lo + MIN_GUARD_RANGE), gw)
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

  const wrapName = p.wrap as Wrap
  const wrap = WRAPS[wrapName] ?? WRAPS.leather!
  const r = f.gripRadius
  const shape = GRIP_SHAPES[p.gripShape as string] ?? GRIP_SHAPES.straight!
  // A one-hand grip is plain; a longer one carries one riser, a two-hand grip at most two.
  const riserAt = G < 130 ? [] : G < 230 ? [0.5] : [0.38, 0.62]
  const grip: SwordSpec['grip'] = {
    from: P,
    to: guardFrom,
    radius: shape.map(([u, k]): [number, number] => [u, k * r]),
    oval: katana ? 0.78 : 0.82,
    wrap: wrapName,
    pitchMm: wrap.pitch(G),
    risers: wrapName === 'leather' ? riserAt : [],
  }
  const gripHex = wrap.colour(p)

  const pommel = {
    style: p.pommel as PommelStyle,
    from: 0,
    to: P,
    radius: pommelD / 2,
    facets: POMMEL_FACETS[p.pommel as string] ?? 0,
  }

  const cut = p.gemCut as GemCut
  const gems: SwordSpec['gems'] = []
  if (p.gems === 'pommel' || p.gems === 'both')
    // A flat face (wheel, cap) takes a bigger stone than a rounded top.
    gems.push({
      at: 'pommel',
      cut,
      radius:
        ((p.pommel === 'wheel' || p.pommel === 'cap' ? 0.54 : 0.45) * pommelD * POMMEL_FACE) / 2,
    })
  if (p.gems === 'guard' || p.gems === 'both') {
    const block = style === 'disc' ? 0.5 * ((span - base) / 2) : 0.8 * base
    gems.push({ at: 'guard', cut, radius: (GUARD_GEM * block) / 2 })
  }

  const runeHex = swordSwatchFor('runeColour', p.runeColour as string) ?? '#8fe3ff'
  let runes: SwordSpec['runes'] = null
  if (hasRunes(p)) {
    const seed = seedOf(p)
    const run = lerp(0.25, 0.4, hasGroove(p) ? (p.grooveLength as number) : 0.5) * B
    const fuller = fullers.reduce<Fuller | null>(
      (a, b) => (a && Math.abs(a.offset - 0.5) <= Math.abs(b.offset - 0.5) ? a : b),
      null,
    )
    const cluster = 3 + (seed % 2)
    if (fuller && (p.runes === 'groove' || p.runes === 'base')) {
      const from = p.runes === 'groove' ? Math.max(bladeFrom + 40, fuller.from) : fuller.from + 5
      const halfHeight = (0.65 * 2 * fuller.halfWidth * widthAt(from)) / 2
      const want = p.runes === 'groove' ? run : cluster * 2 * halfHeight * 1.35
      const to = Math.max(from + 20, Math.min(from + want, fuller.to - fuller.fade))
      const glyphs = glyphsIn(to - from, halfHeight)
      runes = {
        from,
        to,
        halfHeight,
        where: 'fuller',
        glyphs: p.runes === 'base' ? Math.min(cluster, glyphs) : glyphs,
        seed,
        colour: runeHex,
      }
    } else if (p.runes === 'centre') {
      const from = bladeFrom + ricasso + 40
      const halfHeight = RUNE_FLAT * base
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
      const halfHeight = RUNE_FLAT * base
      const from = Math.max(bladeFrom + collar + 15, (engraving?.to ?? 0) + 8)
      runes = {
        from,
        to: from + cluster * 2 * halfHeight * 1.35,
        halfHeight,
        where: 'flat',
        glyphs: cluster,
        seed,
        colour: runeHex,
      }
    }
  }

  const gem = hasGems(p) ? gemLight(p.gemColour as string, runeHex) : null
  const glow: SwordSpec['glow'] = gem && { colour: gem.glow, body: gem.body }

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
      tip: p.tip as Tip,
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
      steel: p.steel as Steel,
      fittings: p.fittings as Fittings,
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
