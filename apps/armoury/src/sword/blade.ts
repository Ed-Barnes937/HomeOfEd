import type { SwordSpec } from './compile.ts'
import { centreLineAt } from './bend.ts'
import { sample } from './curve.ts'
import { type MeshPart, type Station, sweep } from './sweep.ts'

export { centreLineAt }

// The blade: a thickness field over the outline, sampled on columns that sit on
// its feature lines, swept from below the shoulder to an apex at the tip.
// x runs across (+x the edge, -x the back or second edge), y through the thickness.

/** Support columns either side of a crease, mm: a tight real radius from smooth normals. */
const SUPPORT = 0.2
/** How far the blade runs inside the guard, mm. */
const SHOULDER_OVERLAP = 1
/** The edge bevel's slope over the face's where they meet. */
const BEVEL_STEEPER = 2
const MAX_BEVEL_SLOPE = 0.84
/** Near the point, half-thickness never exceeds the edge flat plus this much per mm of width. */
const POINT_SLOPE = 0.3
const MAX_FULLER_DEPTH = 0.35
/** The bevel never takes more than this share of its side. */
const BEVEL_ROOM = 0.4
/** The bevel starts no higher than this share of the way from the edge flat to the crest. */
const BEVEL_START_MAX = 0.7
/** A crowned face rises at most this share of its drop, so the crest stays its highest point. */
const CROWN_LIMIT = 0.2
const RICASSO_RUN = 10
/** Single-edged: the crest as a fraction of the width from the edge, and the spine's thickness over the crest's. */
const CREST_FROM_EDGE = { sabre: 0.85, falseEdge: 0.65 }
/** The crest stays this share of the width beyond a fuller's far rim. */
const CREST_CLEARANCE = 0.05
/** A fuller eases in over this many of its half-widths, at least the minimum in mm. */
const FULLER_RUN_IN = 1.5
const FULLER_RUN_IN_MIN = 6
const SPINE = { sabre: 0.92, katana: 0.8 }
/** The Sabre's false edge: a cut at the back corner that widens to the edge bevel's width at this slope. */
const FALSE_EDGE_SLOPE = 0.45
/** It grows in over this much of the blade (u) before the point or the flare, from this share of its width. */
const FALSE_EDGE_START = 0.4
/** How softly the false edge meets the edge flat, mm. */
const SOFT_FLOOR = 0.1
const FALSE_EDGE_LEAD = 0.25
/** The Katana's point section is thinned toward the tip by this share, which draws the yokote line. */
const KISSAKI_THIN = 0.4
/** And steps down this share across the yokote ring, so the crease reads across the whole face. */
const YOKOTE_STEP = 0.1
/** Flame waves never move an edge further than this, mm. */
const WAVE_MAX_MM = 1.5
/** Columns on one face, before the six on the two end faces. */
const FACE_COLUMNS = 31
const FINE = 0.5
/** Rings: about this many along a plain blade, kept within these steps (mm). */
const RINGS_ALONG_PLAIN = 300
const PLAIN_STEP = [2, 4] as const
/** Ring steps grow by this much per mm away from a feature. */
const FEATURE_GRADE = 0.3
const RINGS_PER_WAVE = 30
const WAVE_STEP = [1, 3] as const
/** No ring moves an edge more than this (mm), or turns the centre line more than this (radians). */
const MAX_WIDTH_STEP = 1
const MAX_TURN_PER_RING = 0.02
const WIDTH_PROBE = 0.05
const FINEST = 0.05
/** A spent fuller's rim columns stay this share of its half-width apart. */
const RIM_FLOOR = 0.08
/** Cavity shading: how dark at the shoulder and in a fuller's run-out, and how far past the shoulder. */
const SHADE = { shoulder: 0.4, fullerEnd: 0.3 }
const SHOULDER_SHADE_MM = 5
/** Where columns are laid out when the blade has no fuller, u. */
const REFERENCE_U = 0.3
/** Anchors closer than this at the reference station are one column. */
const MERGE_GAP = 0.05
/** Steps for the thickness field's slopes, mm. */
const SLOPE_STEP = 0.004
const NORMAL_STEP = 0.02

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

export interface BladeSide {
  /** From the centre line to this side's end, mm. */
  width: number
  /** Width of the cutting bevel at this end, mm. */
  bevel: number
  /** Half-thickness of the end face, mm. */
  end: number
  /** 1 where this end is sharpened, 0 where it is blunt (ricasso, spine). */
  sharp: number
}

export interface BladeFuller {
  /** Centre across, mm. */
  x: number
  /** Where the dish meets the face, mm from its centre (narrows as it runs out). */
  rim: number
  /** Depth now, mm, and as a fraction of its full depth. */
  depth: number
  strength: number
  /** Half its width at full depth, mm. */
  halfWidth: number
}

export interface BladeSection {
  z: number
  edge: BladeSide
  back: BladeSide
  /** Where the blade is thickest, x. */
  crest: number
  /** Half-thickness at the crest, mm. */
  T: number
  fullers: BladeFuller[]
  /** Half-thickness before the fullers. */
  base(x: number): number
  half(x: number): number
}

type FaceShape = 'arc' | 'crowned' | 'convex'

/** One side of the section, from the crest (d = 0) to its end face (d = length). */
interface Profile {
  T: number
  length: number
  /** The face runs from T over this many mm to `faceTo`. */
  faceLength: number
  faceTo: number
  shape: FaceShape
  crown: number
  /** The zone at the end: a straight cut down to `end`, or (uncreased) the face carrying on. */
  bevel: number
  end: number
  creased: boolean
}

function faceAt(p: Profile, d: number): number {
  const t = p.faceLength > 0 ? d / p.faceLength : 1
  const drop = p.T - p.faceTo
  if (p.shape === 'arc') return p.T - drop * t * t
  if (p.shape === 'convex') return p.T - drop * (0.5 * t + 0.5 * t * t * t)
  return p.T - drop * t + Math.min(p.crown, CROWN_LIMIT * drop) * 4 * t * (1 - t)
}

/** Half-thickness at distance d from the crest toward this side's end. */
function heightOn(p: Profile, d: number): number {
  const x = clamp(d, 0, p.length)
  const start = p.length - p.bevel
  if (!p.creased || x <= start) return faceAt(p, x)
  return lerp(faceAt(p, start), p.end, p.bevel > 0 ? (x - start) / p.bevel : 1)
}

const softMin = (a: number, b: number) => (a * b) / Math.pow(a ** 4 + b ** 4, 0.25) || 0
/** A bevel narrows smoothly into the point, never a kink in its line. */
const narrowed = (wanted: number, length: number) =>
  softMin(wanted, BEVEL_ROOM * Math.max(length, 0))

/**
 * A cutting side: a face down to the bevel start, solved so the bevel is clearly steeper, then
 * the bevel to the edge flat. Unsharpened (a ricasso), the face just carries on to a square edge.
 */
function edgeProfile(
  T: number,
  length: number,
  wanted: number,
  flat: number,
  sharp: number,
  shape: FaceShape,
  crown: number,
): Profile {
  const bevel = narrowed(wanted, length)
  const run = length - bevel
  const p: Profile = {
    T,
    length,
    faceLength: run,
    faceTo: flat,
    shape,
    crown,
    bevel,
    end: flat,
    creased: true,
  }
  const slopeAtEnd = () => {
    const drop = T - p.faceTo
    const rise = shape === 'arc' ? drop / 4 : Math.min(crown, CROWN_LIMIT * drop)
    return run > 0 ? (drop + 4 * rise) / run : 0
  }
  for (let i = 0; i < 4; i++) {
    const rise = bevel * softMin(BEVEL_STEEPER * slopeAtEnd(), MAX_BEVEL_SLOPE)
    p.faceTo = flat + softMin(rise, BEVEL_START_MAX * (T - flat))
  }
  p.end = lerp(p.faceTo - slopeAtEnd() * bevel, flat, sharp)
  return p
}

/** How much of a fuller's depth is cut at z: easing in over a short run-in, out over its fade. */
function fullerStrength(f: SwordSpec['blade']['fullers'][number], z: number, hw = 0): number {
  const runIn = clamp(FULLER_RUN_IN * hw, FULLER_RUN_IN_MIN, f.fade)
  return smoothstep(f.from, f.from + runIn, z) * (1 - smoothstep(f.to - f.fade, f.to, z))
}

const bladeLength = (spec: SwordSpec) => spec.blade.to - spec.blade.from
const uOf = (spec: SwordSpec, z: number) => clamp((z - spec.blade.from) / bladeLength(spec), 0, 1)

/** Unwaved half-widths, edge side and back side. */
function outlineAt(spec: SwordSpec, u: number): [number, number] {
  const edge = sample(spec.blade.halfWidth, u)
  return [edge, spec.blade.backWidth ? sample(spec.blade.backWidth, u) : edge]
}

/** Flame waves shift both edges together, leaving the middle straight. */
function waveShift(spec: SwordSpec, z: number, width: number): number {
  const w = spec.blade.wave
  if (!w || z <= w.from || z >= w.to) return 0
  const half = w.lengthMm / 2
  const env = smoothstep(w.from, w.from + half, z) * (1 - smoothstep(w.to - half, w.to, z))
  return (
    Math.min(w.amp * width, WAVE_MAX_MM) * env * Math.sin((2 * Math.PI * (z - w.from)) / w.lengthMm)
  )
}

/** The blade's cross-section at z: its two ends, crest, fullers and thickness field. */
export function bladeSectionAt(spec: SwordSpec, z: number): BladeSection {
  const b = spec.blade
  const u = uOf(spec, z)
  const [edge0, back0] = outlineAt(spec, u)
  const width0 = edge0 + back0
  const shift = waveShift(spec, z, width0)
  const edgeW = Math.max(0, edge0 + shift)
  const backW = Math.max(0, back0 - shift)
  const width = edgeW + backW
  const single = b.edges === 'single'
  const katana = spec.family === 'katana'
  const flat = b.edgeFlat / 2
  const yokote = b.from + b.tipFrom * (b.to - b.from)
  const kissaki = !katana
    ? 1
    : (1 - YOKOTE_STEP * smoothstep(yokote - SUPPORT, yokote + SUPPORT, z)) *
      (u > b.tipFrom ? 1 - (KISSAKI_THIN * (u - b.tipFrom)) / (1 - b.tipFrom) : 1)
  // A soft minimum: a hard one would crease the faces across where the point starts to thin them.
  const T = softMin((kissaki * sample(b.thickness, u)) / 2, flat + POINT_SLOPE * width)

  let backSharp = 0
  if (single) {
    const flared =
      b.backBevelFrom === null
        ? 0
        : smoothstep(b.backBevelFrom - FALSE_EDGE_LEAD, b.backBevelFrom, u)
    const point = katana ? 0 : smoothstep(b.tipFrom - FALSE_EDGE_LEAD, b.tipFrom, u)
    backSharp = Math.max(flared, point)
  }
  // A false edge needs room on the back, so the Sabre's crest walks toward the middle as it grows.
  // It keeps clear of a fuller: the crest sits beyond the fuller's far rim, and walks only once the fuller has run out.
  const clear = Math.max(
    CREST_FROM_EDGE.sabre,
    ...b.fullers.map((f) => f.offset + f.halfWidth + CREST_CLEARANCE),
  )
  const fullerLeft = Math.max(0, ...b.fullers.map((f) => fullerStrength(f, z)))
  const crestAt = b.ridgeAt ?? lerp(clear, CREST_FROM_EDGE.falseEdge, backSharp * (1 - fullerLeft))
  const crest = !single ? 0 : edgeW - crestAt * width
  const edgeSharp =
    b.ricasso > 0 ? smoothstep(b.from + b.ricasso, b.from + b.ricasso + RICASSO_RUN, z) : 1
  const shape: FaceShape = b.section === 'lenticular' ? 'arc' : 'crowned'
  const edgeP = katana
    ? {
        T,
        length: edgeW - crest,
        faceLength: edgeW - crest,
        faceTo: flat,
        shape: 'convex' as const,
        crown: b.crown,
        bevel: narrowed(b.edgeBevel, edgeW - crest),
        end: flat,
        creased: false,
      }
    : edgeProfile(T, edgeW - crest, b.edgeBevel, flat, edgeSharp, shape, b.crown)
  let backP: Profile
  if (!single) {
    backSharp = edgeSharp
    backP = edgeProfile(T, crest + backW, b.edgeBevel, flat, edgeSharp, shape, b.crown)
  } else {
    const length = crest + backW
    backP = {
      T,
      length,
      faceLength: length,
      faceTo: (katana ? SPINE.katana : SPINE.sabre) * T,
      shape: 'crowned',
      crown: b.crown,
      bevel: katana ? 0 : narrowed(lerp(FALSE_EDGE_START, 1, backSharp) * b.edgeBevel, length),
      end: 0,
      creased: true,
    }
    // The cut keeps its column and deepens from the face's own slope, so its crease never moves across a column.
    const start = length - backP.bevel
    const faceSlope = (faceAt(backP, start - SLOPE_STEP) - faceAt(backP, start)) / SLOPE_STEP
    const above =
      faceAt(backP, start) - backP.bevel * (faceSlope + backSharp * FALSE_EDGE_SLOPE) - flat
    // Never thicker than the face it cuts, even where the point has thinned everything to the flat.
    backP.end =
      flat + Math.min((above + Math.hypot(above, SOFT_FLOOR)) / 2, faceAt(backP, start) - flat)
  }
  const base = (x: number) => (x >= crest ? heightOn(edgeP, x - crest) : heightOn(backP, crest - x))

  const fullers = b.fullers.map((f) => {
    // On a Sabre the fuller keeps its share of the edge-to-crest span, so a walking crest never crosses its columns.
    const x =
      single && !katana ? edgeW - (f.offset / clear) * (edgeW - crest) : edge0 - f.offset * width0
    const hw = f.halfWidth * width0
    const strength = fullerStrength(f, z, hw)
    const full = Math.min(f.depth, MAX_FULLER_DEPTH) * base(x)
    return {
      x,
      rim: hw * Math.sqrt(strength),
      depth: full * strength,
      strength,
      halfWidth: hw,
      full,
    }
  })

  const half = (x: number) => {
    let h = base(x)
    for (const f of fullers) {
      if (f.strength <= 0) continue
      const r = (x - f.x) / f.halfWidth
      h -= Math.max(0, f.full * (f.strength - r * r))
    }
    return h
  }

  return {
    z,
    edge: { width: edgeW, bevel: edgeP.bevel, end: edgeP.end, sharp: edgeSharp },
    back: { width: backW, bevel: backP.bevel, end: backP.end, sharp: backSharp },
    crest,
    T,
    fullers,
    base,
    half,
  }
}

/** Half-thickness at s across (-1 the back or second edge, +1 the edge) and z along. */
export function halfThicknessAt(spec: SwordSpec, s: number, z: number): number {
  const section = bladeSectionAt(spec, z)
  return section.half(s >= 0 ? s * section.edge.width : s * section.back.width)
}

/** Where the rings go along z: 2-4 mm on plain stretches, finer near features and on fast changes. */
function ringPositions(spec: SwordSpec): number[] {
  const b = spec.blade
  const B = bladeLength(spec)
  const plain = clamp(B / RINGS_ALONG_PLAIN, PLAIN_STEP[0], PLAIN_STEP[1])
  const features = [b.from, b.to, b.from + b.tipFrom * B]
  if (b.ricasso > 0) features.push(b.from + b.ricasso, b.from + b.ricasso + RICASSO_RUN)
  for (const f of b.fullers) features.push(f.from, f.to, f.to - f.fade)
  const widthAt = (z: number) => {
    const [edge, back] = outlineAt(spec, uOf(spec, z))
    const shift = waveShift(spec, z, edge + back)
    return [edge + shift, back - shift] as const
  }
  const spacing = (z: number) => {
    let d = plain
    for (const f of features) d = Math.min(d, FINE + FEATURE_GRADE * Math.abs(z - f))
    const w = b.wave
    if (w && z > w.from - 2 && z < w.to + 2)
      d = Math.min(d, clamp(w.lengthMm / RINGS_PER_WAVE, WAVE_STEP[0], WAVE_STEP[1]))
    const [e0, b0] = widthAt(z)
    const [e1, b1] = widthAt(Math.min(b.to, z + WIDTH_PROBE))
    const change = Math.max(Math.abs(e1 - e0), Math.abs(b1 - b0)) / WIDTH_PROBE
    if (change > 0) d = Math.min(d, MAX_WIDTH_STEP / change)
    const { curvature } = centreLineAt(spec, z)
    if (curvature > 0) d = Math.min(d, MAX_TURN_PER_RING / curvature)
    return clamp(d, FINEST, plain)
  }
  const zs = [b.from - SHOULDER_OVERLAP]
  let z = zs[0]!
  for (;;) {
    let d = spacing(z)
    d = Math.min(d, spacing(Math.min(b.to, z + d)))
    if (z + d >= b.to - 0.3 * d) break
    z += d
    zs.push(z)
  }
  zs.push(b.to)
  if (spec.family !== 'katana') return zs
  // The yokote is a crease across the blade: a ring on it and one close either side.
  const yokote = b.from + b.tipFrom * B
  const near = [yokote - SUPPORT, yokote, yokote + SUPPORT]
  return [...zs.filter((z) => near.every((n) => Math.abs(z - n) > SUPPORT / 2)), ...near].sort(
    (a, c) => a - c,
  )
}

type Anchor = (s: BladeSection) => number

/** The columns across one face, as functions of the section, ordered at a reference station. */
function anchorsFor(spec: SwordSpec): Anchor[] {
  const b = spec.blade
  const single = b.edges === 'single'
  const katana = spec.family === 'katana'
  const edgeLength = (s: BladeSection) => s.edge.width - s.crest
  const backLength = (s: BladeSection) => s.back.width + s.crest
  /** Support spacing on a side, from its full bevel so it never collapses while a bevel grows. */
  const sup = (length: number) =>
    Math.min(SUPPORT, 0.3 * narrowed(b.edgeBevel, length), 0.15 * length)
  const anchors: Anchor[] = [
    (s) => s.edge.width,
    (s) => s.edge.width - sup(edgeLength(s)),
    (s) => -s.back.width,
    (s) => -s.back.width + sup(backLength(s)),
    (s) => s.crest,
  ]
  const crease = (at: Anchor, support: (s: BladeSection) => number) =>
    anchors.push(
      at,
      (s) => at(s) - support(s),
      (s) => at(s) + support(s),
    )
  if (katana) anchors.push((s) => s.edge.width - s.edge.bevel)
  else
    crease(
      (s) => s.edge.width - s.edge.bevel,
      (s) => sup(edgeLength(s)),
    )
  if (!single)
    crease(
      (s) => -s.back.width + s.back.bevel,
      (s) => sup(backLength(s)),
    )
  else if (!katana)
    crease(
      (s) => -s.back.width + s.back.bevel,
      (s) => sup(backLength(s)),
    )
  if (single || b.section === 'diamond') {
    const support = (s: BladeSection) =>
      Math.min(SUPPORT, 0.15 * (s.edge.width - s.crest), 0.15 * (s.back.width + s.crest))
    anchors.push(
      (s) => s.crest - support(s),
      (s) => s.crest + support(s),
    )
  }
  b.fullers.forEach((_, k) => {
    const rim = (s: BladeSection) => {
      const f = s.fullers[k]!
      return Math.max(f.rim, RIM_FLOOR * f.halfWidth)
    }
    const at = (s: BladeSection) => s.fullers[k]!.x
    const support = (s: BladeSection) => Math.min(SUPPORT, 0.3 * rim(s))
    anchors.push(at)
    for (const side of [-1, 1]) {
      const edge = (s: BladeSection) => at(s) + side * rim(s)
      anchors.push(
        edge,
        (s) => edge(s) - side * support(s),
        (s) => edge(s) + side * support(s),
      )
    }
  })
  return anchors
}

interface Template {
  anchors: Anchor[]
  /** Fill columns after each anchor, in order. */
  fills: number[]
}

function templateFor(spec: SwordSpec): Template {
  const b = spec.blade
  const f = b.fullers[0]
  const z = f ? (f.from + f.to - f.fade) / 2 : b.from + REFERENCE_U * bladeLength(spec)
  const ref = bladeSectionAt(spec, z)
  const raw = anchorsFor(spec).map((fn) => ({ fn, x: fn(ref) }))
  raw.sort((a, c) => a.x - c.x)
  const unique = raw.filter((a, i) => i === 0 || a.x - raw[i - 1]!.x > MERGE_GAP)
  const gaps = unique.slice(1).map((a, i) => a.x - unique[i]!.x)
  const budget = Math.max(0, FACE_COLUMNS - unique.length)
  const room = gaps.reduce((s, g) => s + (g > 1 ? g : 0), 0)
  const fills = gaps.map((g) => (g > 1 && room > 0 ? Math.floor((budget * g) / room) : 0))
  let left = budget - fills.reduce((s, n) => s + n, 0)
  const order = gaps
    .map((g, i) => ({ i, r: g > 1 && room > 0 ? (budget * g) / room - fills[i]! : -1 }))
    .sort((a, c) => c.r - a.r || a.i - c.i)
  for (const { i, r } of order) {
    if (left <= 0 || r < 0) break
    fills[i]!++
    left--
  }
  fills.push(0)
  return { anchors: unique.map((a) => a.fn), fills }
}

/** The face's column positions at a section, ascending x, strictly increasing. */
function columnsAt(t: Template, s: BladeSection): number[] {
  const lo = -s.back.width
  const hi = s.edge.width
  const count = t.anchors.length + t.fills.reduce((a, n) => a + n, 0)
  const gap = Math.min(0.01, (hi - lo) / (4 * count))
  const xs = t.anchors.map((fn) => clamp(fn(s), lo, hi))
  xs[0] = lo
  xs[xs.length - 1] = hi
  for (let i = 1; i < xs.length; i++) xs[i] = Math.max(xs[i]!, xs[i - 1]! + gap)
  for (let i = xs.length - 2; i >= 0; i--) xs[i] = Math.min(xs[i]!, xs[i + 1]! - gap)
  const out: number[] = []
  xs.forEach((x, i) => {
    out.push(x)
    const n = t.fills[i]!
    for (let k = 1; k <= n; k++) out.push(lerp(x, xs[i + 1]!, k / (n + 1)))
  })
  return out
}

/** The blade's stations from just inside the guard to the apex, with their attributes. */
export function bladeStations(spec: SwordSpec): Station[] {
  const b = spec.blade
  const template = templateFor(spec)
  const zs = ringPositions(spec)
  const stations: Station[] = []
  zs.forEach((z, j) => {
    const line = centreLineAt(spec, z)
    const frame = {
      centre: [line.x, 0, line.z] as [number, number, number],
      axisU: [Math.cos(line.angle), 0, Math.sin(line.angle)] as [number, number, number],
      axisV: [0, 1, 0] as [number, number, number],
      uvAlong: z - zs[0]!,
    }
    const aAlong = uOf(spec, z)
    if (j === zs.length - 1) {
      const one = (v: number) => new Float32Array([v])
      stations.push({
        ...frame,
        section: new Float32Array(),
        attrs: { aAlong: one(1), aEdge: one(1), aFuller: one(0), aShade: one(1) },
      })
      return
    }
    const s = bladeSectionAt(spec, z)
    const ahead = bladeSectionAt(spec, z + NORMAL_STEP)
    const xs = columnsAt(template, s)
    const points: [number, number][] = []
    const normals = new Float32Array((2 * xs.length + 6) * 3)
    let k = 0
    const push = (x: number, y: number, z: number) => {
      const l = Math.hypot(x, y, z)
      normals[k++] = x / l
      normals[k++] = y / l
      normals[k++] = z / l
    }
    // Exact normals from the thickness field: -dh/dx across, -dh/dz along (per mm of path at x).
    const along = (x: number, rate: number) => rate / NORMAL_STEP / (1 + line.curvature * x)
    const toEdge = along(s.edge.width, s.edge.width - ahead.edge.width)
    const toBack = along(-s.back.width, s.back.width - ahead.back.width)
    const edgeLen = Math.hypot(1, toEdge)
    const backLen = Math.hypot(1, toBack)
    /** Sum of unit normals of the face either side of x (or one side and an end face at a corner). */
    const facePoint = (i: number, up: number) => {
      const x = xs[i]!
      const h = s.half(x)
      points.push([x, up * h])
      const hz = -along(x, ahead.half(x) - h)
      let nx = 0
      let ny = 0
      let nz = 0
      const add = (slope: number) => {
        const l = Math.hypot(slope, 1, hz)
        nx -= slope / l
        ny += up / l
        nz += hz / l
      }
      if (i > 0) add((h - s.half(x - SLOPE_STEP)) / SLOPE_STEP)
      else [nx, nz] = [nx - 1 / backLen, nz + toBack / backLen]
      if (i < xs.length - 1) add((s.half(x + SLOPE_STEP) - h) / SLOPE_STEP)
      else [nx, nz] = [nx + 1 / edgeLen, nz + toEdge / edgeLen]
      push(nx, ny, nz)
    }
    const endFace = (x: number, h: number, down: boolean, nx: number, nz: number) => {
      const sup = Math.min(SUPPORT, 0.35 * h)
      const ys = [h - sup, 0, sup - h]
      for (const y of down ? ys : ys.reverse()) {
        points.push([x, y])
        push(nx, 0, nz)
      }
    }
    for (let i = xs.length - 1; i >= 0; i--) facePoint(i, 1)
    endFace(-s.back.width, s.half(-s.back.width), true, -1, toBack)
    for (let i = 0; i < xs.length; i++) facePoint(i, -1)
    endFace(s.edge.width, s.half(s.edge.width), false, 1, toEdge)

    const shoulder = 1 - smoothstep(b.from - SHOULDER_OVERLAP, b.from + SHOULDER_SHADE_MM, z)
    const n = points.length
    const section = new Float32Array(n * 2)
    const attrs = {
      aAlong: new Float32Array(n).fill(aAlong),
      aEdge: new Float32Array(n),
      aFuller: new Float32Array(n),
      aShade: new Float32Array(n),
    }
    points.forEach(([x, y], i) => {
      section[i * 2] = x
      section[i * 2 + 1] = y
      const onEdge = x >= s.crest
      const side = onEdge ? s.edge : s.back
      const fromEnd = onEdge ? s.edge.width - x : x + s.back.width
      attrs.aEdge[i] = fromEnd <= side.bevel + 1e-9 ? side.sharp : 0
      let floor = 0
      let cavity = 0
      for (const f of s.fullers) {
        if (f.strength <= 0 || Math.abs(x - f.x) > f.rim) continue
        floor = Math.max(floor, f.strength)
        const depthHere = f.rim > 0 ? 1 - ((x - f.x) / f.rim) ** 2 : 0
        cavity = Math.max(cavity, depthHere * 4 * f.strength * (1 - f.strength))
      }
      attrs.aFuller[i] = floor
      attrs.aShade[i] = 1 - SHADE.shoulder * shoulder - SHADE.fullerEnd * cavity
    })
    stations.push({ ...frame, section, attrs, normals })
  })
  return stations
}

/** The blade as one closed part: fan-capped inside the guard, closing to an apex at the tip. */
export function bladePart(spec: SwordSpec): MeshPart {
  return sweep(bladeStations(spec), { capStart: 'fan', capEnd: 'apex', seam: false })
}
