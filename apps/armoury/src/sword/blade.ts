import type { SwordSpec } from './compile.ts'
import { sample } from './curve.ts'
import { type MeshPart, type Station, sweep } from './sweep.ts'

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
/** Unsharpened edge (ricasso) half-thickness, as a fraction of the crest's. */
const BLUNT_EDGE = 0.35
const RICASSO_RUN = 10
/** Single-edged: the crest as a fraction of the width from the edge, and the spine's thickness. */
const SABRE_CREST = 0.85
const SPINE: Record<string, number> = { katana: 0.8 }
const SABRE_SPINE = 0.92
/** Columns on one face, before the six on the two end faces. */
const FACE_COLUMNS = 31
const FINE = 0.5
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

interface Profile {
  T: number
  length: number
  bevel: number
  sharpEnd: number
  bluntEnd: number
  sharp: number
  arc: boolean
  crown: number
  /** Bevel start height, solved so the bevel is steeper than the face. */
  hb: number
}

/** A face falling from T at t = 0 to `to` at t = 1, crowned or an arc. */
function face(p: Profile, to: number, t: number): number {
  const drop = p.T - to
  const rise = p.arc ? drop / 4 : Math.min(p.crown, 0.2 * drop)
  return p.T - drop * t + rise * 4 * t * (1 - t)
}

function profile(
  T: number,
  length: number,
  bevelWanted: number,
  sharpEnd: number,
  bluntEnd: number,
  sharp: number,
  arc: boolean,
  crown: number,
): Profile {
  // A soft minimum, so the bevel narrows into the point without a kink in its line.
  const room = 0.4 * Math.max(length, 0)
  const bevel = (bevelWanted * room) / Math.pow(bevelWanted ** 4 + room ** 4, 0.25) || 0
  const run = length - bevel
  const p: Profile = { T, length, bevel, sharpEnd, bluntEnd, sharp, arc, crown, hb: sharpEnd }
  for (let i = 0; i < 4; i++) {
    const drop = T - p.hb
    const rise = arc ? drop / 4 : Math.min(crown, 0.2 * drop)
    const faceSlope = run > 0 ? (drop + 4 * rise) / run : 0
    p.hb = sharpEnd + bevel * Math.min(BEVEL_STEEPER * faceSlope, MAX_BEVEL_SLOPE)
    p.hb = Math.min(p.hb, sharpEnd + 0.7 * (T - sharpEnd))
  }
  return p
}

/** Half-thickness at distance d from the crest toward this side's end. */
function heightOn(p: Profile, d: number): number {
  const x = clamp(d, 0, p.length)
  const blunt = p.length > 0 ? face(p, p.bluntEnd, x / p.length) : p.T
  const run = p.length - p.bevel
  const sharp =
    x <= run
      ? face(p, p.hb, run > 0 ? x / run : 1)
      : lerp(p.hb, p.sharpEnd, p.bevel > 0 ? (x - run) / p.bevel : 1)
  return lerp(blunt, sharp, p.sharp)
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
  return w.amp * width * env * Math.sin((2 * Math.PI * (z - w.from)) / w.lengthMm)
}

const CURVE_SAMPLES = 1024
const FIT_SAMPLES = 96
interface Bend {
  /** Tangent angle toward the spine at u is k * u^(p + 1). */
  k: number
  p: number
  x: Float64Array
  z: Float64Array
}
const bends = new Map<string, Bend>()

/** Lays the bent centre line out by arc length (Simpson's rule per step), for a given angle law. */
function layOut(k: number, p: number, B: number, samples: number): Bend {
  const x = new Float64Array(samples + 1)
  const z = new Float64Array(samples + 1)
  const ds = B / samples
  const angle = (u: number) => k * Math.pow(u, p + 1)
  for (let i = 1; i <= samples; i++) {
    const a = angle((i - 1) / samples)
    const m = angle((i - 0.5) / samples)
    const b = angle(i / samples)
    x[i] = x[i - 1]! - (ds * (Math.sin(a) + 4 * Math.sin(m) + Math.sin(b))) / 6
    z[i] = z[i - 1]! + (ds * (Math.cos(a) + 4 * Math.cos(m) + Math.cos(b))) / 6
  }
  return { k, p, x, z }
}

/** The deepest distance off the shoulder-to-tip chord, and the u where it falls (refined between samples). */
function sagitta(bend: Bend): [depth: number, at: number] {
  const n = bend.x.length - 1
  const cx = bend.x[n]!
  const cz = bend.z[n]!
  const len = Math.hypot(cx, cz)
  const off = (i: number) => Math.abs(bend.x[i]! * cz - bend.z[i]! * cx) / len
  let best = 0
  for (let i = 1; i <= n; i++) if (off(i) > off(best)) best = i
  if (best === 0 || best === n) return [off(best), best / n]
  const [a, b, c] = [off(best - 1), off(best), off(best + 1)]
  const shift = (a - c) / (2 * (a - 2 * b + c))
  return [b - ((a - c) * shift) / 4, (best + shift) / n]
}

/** The angle law whose sagitta is `depth` at `peak`: curvature grows as u^p, so a later peak bends harder near the tip. */
function bendFor(B: number, depth: number, peak: number): Bend {
  const key = `${B}|${depth}|${peak}`
  const cached = bends.get(key)
  if (cached) return cached
  const fitK = (p: number) => {
    let lo = 0
    let hi = 2.5
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (sagitta(layOut(mid, p, B, FIT_SAMPLES))[0] < depth) lo = mid
      else hi = mid
    }
    return (lo + hi) / 2
  }
  const peakOf = (p: number) => sagitta(layOut(fitK(p), p, B, FIT_SAMPLES))[1]
  let lo = 0
  let hi = 12
  if (peakOf(0) >= peak) hi = 0
  for (let i = 0; i < 16 && hi > 0; i++) {
    const mid = (lo + hi) / 2
    if (peakOf(mid) < peak) lo = mid
    else hi = mid
  }
  const bend = layOut(fitK(hi), hi, B, CURVE_SAMPLES)
  bends.set(key, bend)
  return bend
}

export interface CentreLine {
  /** Bent position in the blade plane, mm. */
  x: number
  z: number
  /** Tangent angle toward the spine, radians. */
  angle: number
  /** Per mm along the blade. */
  curvature: number
}

/**
 * The blade's centre line at straight z: bent toward the spine with zero offset and slope at
 * the shoulder, keeping its length along the curve, so the sagitta off the shoulder-to-tip
 * chord is `curve.depthMm` at u = `curve.peak`.
 */
export function centreLineAt(spec: SwordSpec, z: number): CentreLine {
  const c = spec.blade.curve
  const { from } = spec.blade
  if (!c || c.depthMm <= 0 || z <= from) return { x: 0, z, angle: 0, curvature: 0 }
  const B = bladeLength(spec)
  const bend = bendFor(B, c.depthMm, c.peak)
  const u = uOf(spec, z)
  const f = u * CURVE_SAMPLES
  const i = Math.min(CURVE_SAMPLES - 1, Math.floor(f))
  const t = f - i
  return {
    x: lerp(bend.x[i]!, bend.x[i + 1]!, t),
    z: from + lerp(bend.z[i]!, bend.z[i + 1]!, t),
    angle: bend.k * Math.pow(u, bend.p + 1),
    curvature: (bend.k * (bend.p + 1) * Math.pow(u, bend.p)) / B,
  }
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
  const flat = b.edgeFlat / 2
  const T = Math.min(sample(b.thickness, u) / 2, flat + POINT_SLOPE * width)

  const crest = !single ? 0 : edgeW - (b.ridgeAt ?? SABRE_CREST) * width
  const edgeSharp =
    b.ricasso > 0 ? smoothstep(b.from + b.ricasso, b.from + b.ricasso + RICASSO_RUN, z) : 1
  let backSharp = edgeSharp
  let spine = BLUNT_EDGE * T
  if (single) {
    const katana = b.ridgeAt !== null
    spine = (SPINE[spec.family] ?? SABRE_SPINE) * T
    const flared =
      b.backBevelFrom === null ? 0 : smoothstep(b.backBevelFrom, b.backBevelFrom + 0.06, u)
    const point = katana ? 0 : smoothstep(b.tipFrom, b.tipFrom + 0.4 * (1 - b.tipFrom), u)
    backSharp = Math.max(flared, point)
  }
  const arc = b.section === 'lenticular'
  const edgeP = profile(
    T,
    edgeW - crest,
    b.edgeBevel,
    flat,
    BLUNT_EDGE * T,
    edgeSharp,
    arc,
    b.crown,
  )
  const backP = profile(
    T,
    crest + backW,
    single ? 0.8 * b.edgeBevel : b.edgeBevel,
    flat,
    spine,
    backSharp,
    arc,
    b.crown,
  )
  const base = (x: number) => (x >= crest ? heightOn(edgeP, x - crest) : heightOn(backP, crest - x))

  const fullers = b.fullers.map((f) => {
    const x = edge0 - f.offset * width0
    const hw = f.halfWidth * width0
    const runIn = clamp(1.5 * hw, 6, f.fade)
    const strength =
      smoothstep(f.from, f.from + runIn, z) * (1 - smoothstep(f.to - f.fade, f.to, z))
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
    edge: {
      width: edgeW,
      bevel: edgeP.bevel,
      end: lerp(edgeP.bluntEnd, flat, edgeSharp),
      sharp: edgeSharp,
    },
    back: {
      width: backW,
      bevel: backP.bevel,
      end: lerp(backP.bluntEnd, flat, backSharp),
      sharp: backSharp,
    },
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
  const plain = clamp(B / 300, 2, 4)
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
    for (const f of features) d = Math.min(d, FINE + 0.3 * Math.abs(z - f))
    const w = b.wave
    if (w && z > w.from - 2 && z < w.to + 2) d = Math.min(d, clamp(w.lengthMm / 30, 1, 3))
    const [e0, b0] = widthAt(z)
    const [e1, b1] = widthAt(Math.min(b.to, z + 0.05))
    const change = Math.max(Math.abs(e1 - e0), Math.abs(b1 - b0)) / 0.05
    if (change > 0) d = Math.min(d, 1 / change)
    const { curvature } = centreLineAt(spec, z)
    if (curvature > 0) d = Math.min(d, 0.02 / curvature)
    return clamp(d, 0.05, plain)
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
  return zs
}

type Anchor = (s: BladeSection) => number

/** The columns across one face, as functions of the section, ordered at a reference station. */
function anchorsFor(spec: SwordSpec): Anchor[] {
  const b = spec.blade
  const single = b.edges === 'single'
  const sup = (side: BladeSide, length: number) =>
    Math.min(SUPPORT, 0.3 * side.bevel, 0.15 * length)
  const anchors: Anchor[] = [
    (s) => s.edge.width,
    (s) => s.edge.width - sup(s.edge, s.edge.width - s.crest),
    (s) => -s.back.width,
    (s) => -s.back.width + sup(s.back, s.back.width + s.crest),
    (s) => s.crest,
  ]
  const crease = (at: Anchor, support: (s: BladeSection) => number) =>
    anchors.push(
      at,
      (s) => at(s) - support(s),
      (s) => at(s) + support(s),
    )
  crease(
    (s) => s.edge.width - s.edge.bevel,
    (s) => sup(s.edge, s.edge.width - s.crest),
  )
  if (!single || spec.family !== 'katana')
    crease(
      (s) => -s.back.width + s.back.bevel,
      (s) => sup(s.back, s.back.width + s.crest),
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
      return Math.max(f.rim, 0.08 * f.halfWidth)
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
  const z = f ? (f.from + f.to - f.fade) / 2 : b.from + 0.3 * bladeLength(spec)
  const ref = bladeSectionAt(spec, z)
  const raw = anchorsFor(spec).map((fn) => ({ fn, x: fn(ref) }))
  raw.sort((a, c) => a.x - c.x)
  const unique = raw.filter((a, i) => i === 0 || a.x - raw[i - 1]!.x > 1e-6)
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

    const shoulder = 1 - smoothstep(b.from - SHOULDER_OVERLAP, b.from + 5, z)
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
      attrs.aShade[i] = 1 - 0.4 * shoulder - 0.3 * cavity
    })
    stations.push({ ...frame, section, attrs, normals })
  })
  return stations
}

/** The blade as one closed part: fan-capped inside the guard, closing to an apex at the tip. */
export function bladePart(spec: SwordSpec): MeshPart {
  return sweep(bladeStations(spec), { capStart: 'fan', capEnd: 'apex', seam: false })
}
