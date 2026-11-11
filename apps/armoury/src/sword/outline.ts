import { centreLineAt } from './bend.ts'
import type { SwordSpec } from './compile.ts'
import { sample } from './curve.ts'

// The hilt's shapes as light data (tube samples, lathe profiles, plate outlines), shared by
// the mesh (hilt.ts) and the sword's top-down outline. Main-chunk safe: no mesh modules.
// Straight-sword frame: x across (+x the edge), y through the thickness, z from the pommel's
// end to the tip.

export type Pt = [number, number]
type Vec3 = [number, number, number]

const TAU = Math.PI * 2
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** How far the grip runs into the guard and the pommel, mm. */
export const GRIP_OVERLAP = 1
/** The grip's ends narrow over this run to seat inside what they meet, mm. */
const TUCK_RUN = 10

/** A section carried along a path in the blade plane: centre, in-plane normal, half sizes. */
export interface TubeSample {
  x: number
  z: number
  /** Unit normal in the x-z plane; the section's u axis. */
  nx: number
  nz: number
  /** Section centre along the normal, mm. */
  cu: number
  /** Half size along the normal (in the plane) and through y. */
  hu: number
  hv: number
  /** Corner radius. */
  r: number
}
/** A solid swept along its samples; the first and last close to a point. */
export interface Tube {
  kind: 'tube'
  samples: TubeSample[]
}
/** A solid of revolution about the sword's axis: `[r, z]` from the axis back to the axis. */
export interface Lathe {
  kind: 'lathe'
  profile: Pt[]
  /** Thickness over width of its section. */
  oval: number
  /** Flat facets round it (0 for round), flats facing x and y. */
  facets: number
}
/** A plate: its outline scaled along a profile through its thickness. */
export interface Plate {
  kind: 'plate'
  centre: Vec3
  normal: 'y' | 'z'
  /** Around the centre: (x, z) for a y plate, (x, y) for a z plate, at full scale. */
  outline: Pt[]
  /** `[scale 0..1, offset along the normal]`, from the axis back to the axis. */
  profile: Pt[]
}
export type Shape = Tube | Lathe | Plate

/** Fillets a polyline's interior corners; each corner is `[x, y, radius]`. */
export function rounded(corners: [number, number, number][], seg = 4): Pt[] {
  const out: Pt[] = []
  corners.forEach(([x, y, r], i) => {
    if (i === 0 || i === corners.length - 1 || r <= 0) {
      out.push([x, y])
      return
    }
    const [ax, ay] = corners[i - 1]!
    const [bx, by] = corners[i + 1]!
    const l1 = Math.hypot(ax - x, ay - y)
    const l2 = Math.hypot(bx - x, by - y)
    if (l1 < 1e-9 || l2 < 1e-9) {
      out.push([x, y])
      return
    }
    const d1: Pt = [(ax - x) / l1, (ay - y) / l1]
    const d2: Pt = [(bx - x) / l2, (by - y) / l2]
    const angle = Math.acos(clamp(d1[0] * d2[0] + d1[1] * d2[1], -1, 1))
    if (angle > Math.PI - 1e-3 || angle < 1e-3) {
      out.push([x, y])
      return
    }
    let t = r / Math.tan(angle / 2)
    let rr = r
    const most = 0.48 * Math.min(l1, l2)
    if (t > most) {
      t = most
      rr = t * Math.tan(angle / 2)
    }
    const bl = Math.hypot(d1[0] + d2[0], d1[1] + d2[1])
    const k = rr / Math.sin(angle / 2) / bl
    const c: Pt = [x + (d1[0] + d2[0]) * k, y + (d1[1] + d2[1]) * k]
    const a1 = Math.atan2(y + d1[1] * t - c[1], x + d1[0] * t - c[0])
    let delta = Math.atan2(y + d2[1] * t - c[1], x + d2[0] * t - c[0]) - a1
    if (delta > Math.PI) delta -= TAU
    if (delta < -Math.PI) delta += TAU
    for (let j = 0; j <= seg; j++) {
      const a = a1 + (delta * j) / seg
      out.push([c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a)])
    }
  })
  return out
}

/** An outline as N points round a centre, from the first boundary crossing of each ray. */
function polar(inside: (x: number, y: number) => boolean, n: number, reach: number): Pt[] {
  return Array.from({ length: n }, (_, i): Pt => {
    const a = -Math.PI / 2 + (TAU * i) / n
    const [c, s] = [Math.cos(a), Math.sin(a)]
    const step = reach / 200
    let lo = 0
    while (lo < reach && inside(c * (lo + step), s * (lo + step))) lo += step
    let hi = lo + step
    for (let k = 0; k < 20; k++) {
      const mid = (lo + hi) / 2
      if (inside(c * mid, s * mid)) lo = mid
      else hi = mid
    }
    return [c * lo, s * lo]
  })
}

const circle = (r: number, n: number): Pt[] =>
  Array.from({ length: n }, (_, i): Pt => {
    const a = -Math.PI / 2 + (TAU * i) / n
    return [r * Math.cos(a), r * Math.sin(a)]
  })

/** A plate's through-thickness profile from `[mm out, offset]` corners, as scale fractions of `size`. */
function plateProfile(corners: [number, number, number][], size: number): Pt[] {
  return rounded(corners, 4).map(([s, t]): Pt => [s / size, t])
}

// ---------------------------------------------------------------- layout

interface Seat {
  /** Half sizes across and through that the grip's end must fit inside, mm. */
  x: number
  y: number
}

export interface GemSite {
  at: 'pommel' | 'guard'
  position: Vec3
  normal: Vec3
  along: Vec3
  /** The seat's size (the spec's gem radius), mm. */
  seat: number
  /** How far below the surface point the setting's base must reach, mm. */
  sink: number
}

export interface HiltLayout {
  guard: Shape[]
  pommel: Shape[]
  /** Fittings round the grip (Turk's heads, a fuchi). */
  bands: Shape[]
  guardSeat: Seat
  pommelSeat: Seat
  gems: GemSite[]
  /** The cross's centre block, when the guard has one. */
  block: { hx: number; hy: number; from: number; to: number } | null
}

const layouts = new WeakMap<SwordSpec, HiltLayout>()

const bladeHalfThickness = (spec: SwordSpec) => sample(spec.blade.thickness, 0) / 2
const bladeHalfWidths = (spec: SwordSpec): [edge: number, back: number] => [
  sample(spec.blade.halfWidth, 0),
  sample(spec.blade.backWidth ?? spec.blade.halfWidth, 0),
]
/** The gem setting's lip beyond its seat, mm. */
export const bezelRim = (seat: number) => Math.max(0.8, 0.14 * seat)

/** The grip's relief above its core at most, mm, per wrap. */
export function wrapRelief(spec: SwordSpec): number {
  const p = spec.grip.pitchMm
  switch (spec.grip.wrap) {
    case 'leather':
      return spec.grip.risers.length > 0 ? 1.1 : 0
    case 'cord':
      return 0.32 * p
    case 'wire':
      return 0.3 * p
    case 'diamond':
      return 1.5
    default:
      return 0
  }
}

export function hiltLayout(spec: SwordSpec): HiltLayout {
  const cached = layouts.get(spec)
  if (cached) return cached
  const gems: GemSite[] = []
  const pommel = pommelLayout(spec, gems)
  const guard = guardLayout(spec, gems)
  const layout: HiltLayout = {
    guard: guard.shapes,
    pommel: pommel.shapes,
    bands: bandsFor(spec, guard.seat, pommel.seat, pommelTop(pommel.shapes, spec.pommel.to)),
    guardSeat: guard.seat,
    pommelSeat: pommel.seat,
    gems,
    block: guard.block,
  }
  layouts.set(spec, layout)
  return layout
}

// ---------------------------------------------------------------- the grip

/** The grip's core half-width (x) and half-thickness (y) at z, narrowing at each end into its seat. */
export function gripCore(spec: SwordSpec, z: number): [number, number] {
  const { guardSeat, pommelSeat } = hiltLayout(spec)
  return coreAt(spec, z, guardSeat, pommelSeat)
}

function coreAt(spec: SwordSpec, z: number, guardSeat: Seat, pommelSeat: Seat): [number, number] {
  const { grip } = spec
  const relief = wrapRelief(spec)
  const u = clamp((z - grip.from) / (grip.to - grip.from), 0, 1)
  const r = sample(grip.radius, u)
  let rx = r
  let ry = r * grip.oval
  const tuck = (seat: Seat, d: number) => {
    const w = smoothstep(TUCK_RUN, 0, d)
    rx = Math.min(rx, lerp(rx, seat.x - relief, w))
    ry = Math.min(ry, lerp(ry, seat.y - relief, w))
  }
  tuck(pommelSeat, z - grip.from)
  tuck(guardSeat, grip.to - z)
  return [rx, ry]
}

/** How much of the wrap's relief stands at z: it runs out inside the fittings. */
export const reliefFade = (spec: SwordSpec, z: number) =>
  smoothstep(-GRIP_OVERLAP, 0.5, Math.min(z - spec.grip.from, spec.grip.to - z))

/** Grip seat sizes leave room for the wrap's relief. */
const seatFor = (x: number, y: number): Seat => ({ x: Math.max(1, x), y: Math.max(1, y) })

// ---------------------------------------------------------------- pommels

function pommelLayout(spec: SwordSpec, gems: GemSite[]): { shapes: Shape[]; seat: Seat } {
  const { pommel, grip } = spec
  const R = pommel.radius
  const P = pommel.to
  const gr = sample(grip.radius, 0)
  const gry = gr * grip.oval
  const gemOn = spec.gems.find((g) => g.at === 'pommel')
  const addGem = (position: Vec3, normal: Vec3, along: Vec3, surfaceRadius: number) => {
    if (!gemOn) return
    const seat = gemOn.radius
    const outer = seat * (gemOn.cut === 'marquise' ? 1.45 : 1) + bezelRim(seat)
    const drop = Number.isFinite(surfaceRadius) ? (outer * outer) / (2 * surfaceRadius) : 0
    gems.push({
      at: 'pommel',
      position,
      normal,
      along,
      seat,
      sink: Math.max(0.56 * seat + 0.8, drop + 0.9),
    })
  }

  const lathe = (profile: Pt[], oval = 1, facets = 0): Lathe => ({
    kind: 'lathe',
    profile,
    oval,
    facets,
  })
  /** A lathe profile from `[t, r/R]` points along the pommel, its end button and its top seat. */
  const turned = (shape: [number, number][], neckMin: number, endFillet: number) => {
    const rAt = (t: number) => {
      const base = sample(shape, t) * R
      const w = smoothstep(0.55, 0.85, t)
      return Math.max(base, lerp(base, neckMin, w))
    }
    const corners: [number, number, number][] = [[0, 0, 0]]
    corners.push([rAt(0), 0, endFillet])
    for (let i = 1; i < 40; i++) {
      const t = i / 40
      corners.push([rAt(t), t * P, 0])
    }
    const top = rAt(1)
    corners.push([top, P, 0.7], [0, P, 0])
    return { profile: rounded(corners, 4), top: top - 0.7 }
  }

  switch (pommel.style) {
    case 'ball': {
      const neck = Math.max(0.9 * gr, 0.42 * R)
      const zc = Math.min(R, P / 1.9)
      const rb = zc
      const corners: [number, number, number][] = []
      for (let i = 0; i <= 24; i++) {
        const a = -Math.PI / 2 + (Math.PI * i) / 24
        const z = zc + rb * Math.sin(a)
        const r = rb * Math.cos(a)
        if (i > 12 && (r < neck || z > P - 1.2)) break
        corners.push([r, z, 0])
      }
      const last = corners[corners.length - 1]!
      const neckFrom = Math.min(Math.max(last[1], zc), P - 1.2)
      corners.push([neck, neckFrom, 1.2], [neck, P, 0.6], [0, P, 0])
      if (neck < last[0]) corners.splice(corners.length - 3, 1, [last[0], neckFrom, 0])
      const profile = rounded(corners, 4)
      const top = Math.min(neck, last[0]) - 0.6
      addGem([0, rb, zc], [0, 1, 0], [0, 0, 1], rb)
      return { shapes: [lathe(profile)], seat: seatFor(top - 0.3, top - 0.3) }
    }
    case 'pear': {
      const { profile, top } = turned(
        [
          [0, 0.34],
          [0.06, 0.52],
          [0.17, 0.87],
          [0.35, 1],
          [0.56, 0.86],
          [0.78, 0.55],
          [0.9, 0.5],
          [1, 0.55],
        ],
        Math.max(0.92 * gr, 0.5 * R),
        1.2,
      )
      addGem([0, R, 0.35 * P], [0, 1, 0], [0, 0, 1], R)
      return { shapes: [lathe(profile)], seat: seatFor(top - 0.3, top - 0.3) }
    }
    case 'egg': {
      const { profile, top } = turned(
        [
          [0, 0.3],
          [0.06, 0.62],
          [0.2, 0.9],
          [0.42, 1],
          [0.65, 0.92],
          [0.85, 0.66],
          [0.95, 0.52],
          [1, 0.52],
        ],
        Math.max(0.94 * gr, 0.5 * R),
        1,
      )
      addGem([0, R, 0.42 * P], [0, 1, 0], [0, 0, 1], Infinity)
      return { shapes: [lathe(profile, 1, 8)], seat: seatFor(top - 0.3, top - 0.3) }
    }
    case 'cap': {
      const oval = Math.min(1, grip.oval * 1.03)
      const profile = rounded(
        [
          [0, 0, 0],
          [R, 0.08 * P, 0.3 * R],
          [R, P, 0.7],
          [0, P, 0],
        ],
        5,
      )
      addGem([0, R * oval, 0.5 * P], [0, 1, 0], [0, 0, 1], R * oval)
      return {
        shapes: [lathe(profile, oval)],
        seat: seatFor(R - 1, (R - 0.7) * oval - 0.3),
      }
    }
    case 'wheel':
    case 'nut':
    case 'fishtail':
    case 'lobed':
    case 'block':
      return platePommel(spec, R, P, gry, addGem)
    case 'ring':
    default:
      return ringPommel(spec, R, P, gr)
  }
}

function platePommel(
  spec: SwordSpec,
  R: number,
  P: number,
  gry: number,
  addGem: (position: Vec3, normal: Vec3, along: Vec3, surfaceRadius: number) => void,
): { shapes: Shape[]; seat: Seat } {
  const style = spec.pommel.style
  const D = 2 * R
  // The grip's end tucks this far into the plate's top.
  const H = style === 'wheel' ? D : P * 1.12
  const zc = H / 2
  let outline: Pt[]
  let seatX: number
  let rimHalf: number
  let profile: Pt[]
  if (style === 'wheel') {
    outline = circle(R, 96)
    const depth = H - P
    seatX = Math.sqrt(Math.max(0, R * R - (R - depth) ** 2)) - 0.6
    const tr = Math.max(0.17 * D, 0.9 * gry + 0.7)
    const th = Math.max(0.21 * D, tr / 0.78)
    profile = plateProfile(
      [
        [0, -th, 0],
        [0.52 * R, -th, 0.8],
        [0.9 * R, -tr, 0.8],
        [R, -0.8 * tr, 0.25 * tr],
        [R, 0.8 * tr, 0.25 * tr],
        [0.9 * R, tr, 0.8],
        [0.52 * R, th, 0.8],
        [0, th, 0],
      ],
      R,
    )
    rimHalf = 0.8 * tr - 0.25 * tr * 0.3
    addGem([0, th, zc], [0, 1, 0], [0, 0, 1], Infinity)
  } else {
    const b = H / 2
    let inside: (x: number, z: number) => boolean
    if (style === 'nut') {
      inside = (x, z) => Math.abs(x / R) ** 2.6 + Math.abs(z / b) ** 2.6 <= 1
    } else if (style === 'block') {
      inside = (x, z) => {
        const w = R * (0.72 + 0.28 * clamp((z + b) / (2 * b), 0, 1))
        return Math.abs(x / w) ** 3.2 + Math.abs(z / b) ** 3.2 <= 1
      }
    } else if (style === 'lobed') {
      // A square-cornered bar against the grip, and three lobes rising beyond it, the middle tallest.
      const top = -0.05 * b
      const lobes: [number, number, number, number][] = [
        [0, top, 0.36 * R, 0.95 * b],
        [-0.64 * R, top, 0.3 * R, 0.62 * b],
        [0.64 * R, top, 0.3 * R, 0.62 * b],
      ]
      inside = (x, z) => {
        const bar =
          z >= top &&
          Math.abs(x / R) ** 6 + Math.abs((z - (top + b) / 2) / ((b - top) / 2)) ** 6 <= 1
        return (
          bar || lobes.some(([cx, cz, rx, rz]) => ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 <= 1)
        )
      }
    } else {
      // Fishtail: a neck at the grip, two flared lobes at the end.
      const neck = Math.max(0.36 * R, 0.62 * gry + 3)
      inside = (x, z) => {
        const t = clamp((z + b) / (2 * b), 0, 1)
        const half = lerp(R, neck, smoothstep(0.1, 0.85, t))
        const notch = Math.hypot(x, (z + b * 1.02) * 1.3) < 0.42 * R
        return Math.abs(x) <= half && Math.abs(z) <= b && !notch
      }
    }
    outline = polar(inside, 128, 2 * Math.max(R, b))
    seatX = halfWidthAt(outline, b - (H - P) + 0.5) - 0.6
    const tr = Math.max(style === 'nut' ? 0.2 * D : 0.15 * D, (0.72 * gry + 0.4) / 0.72)
    const th = tr / (style === 'nut' ? 0.72 : 0.82)
    const crown = style === 'nut' ? 0.3 * R : 0.62 * R
    profile = plateProfile(
      [
        [0, -th, 0],
        [crown, -th, style === 'nut' ? 0.3 * R : 0.8],
        [0.92 * R, -tr, 0.8],
        [R, -0.82 * tr, 0.25 * tr],
        [R, 0.82 * tr, 0.25 * tr],
        [0.92 * R, tr, 0.8],
        [crown, th, style === 'nut' ? 0.3 * R : 0.8],
        [0, th, 0],
      ],
      R,
    )
    rimHalf = 0.82 * tr - 0.08 * tr
    if (style === 'nut') addGem([0, th, zc], [0, 1, 0], [0, 0, 1], Infinity)
  }
  const plate: Plate = { kind: 'plate', centre: [0, 0, zc], normal: 'y', outline, profile }
  return { shapes: [plate], seat: seatFor(seatX, rimHalf - 0.5) }
}

/** The outline's half width (x) at height z, from the polygon's crossings. */
function halfWidthAt(outline: Pt[], z: number): number {
  let best = Infinity
  for (let i = 0; i < outline.length; i++) {
    const [x0, z0] = outline[i]!
    const [x1, z1] = outline[(i + 1) % outline.length]!
    if ((z0 - z) * (z1 - z) > 0 || z0 === z1) continue
    const x = x0 + ((z - z0) / (z1 - z0)) * (x1 - x0)
    best = Math.min(best, Math.abs(x))
  }
  return Number.isFinite(best) ? best : 0
}

function ringPommel(spec: SwordSpec, R: number, P: number, gr: number) {
  const rt = Math.max(3.2, 0.13 * 2 * R)
  const rc = R - rt
  const zc = R
  // The ring's two ends meet inside a collar that the grip seats into.
  const gap = Math.asin(Math.min(0.6, (rt * 0.9) / rc))
  const endZ = zc + rc * Math.cos(gap)
  const neckR = Math.max(0.95 * gr, rc * Math.sin(gap) + rt + 1.4)
  const neckFrom = Math.min(endZ - rt - 0.8, P - 4)
  const neck: Lathe = {
    kind: 'lathe',
    profile: rounded(
      [
        [0, neckFrom, 0],
        [neckR, neckFrom, 1.2],
        [neckR, P, 0.6],
        [0, P, 0],
      ],
      4,
    ),
    oval: 1,
    facets: 0,
  }
  const n = 72
  const samples: TubeSample[] = []
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 + gap + ((TAU - 2 * gap) * i) / n
    samples.push({
      x: rc * Math.cos(a),
      z: zc + rc * Math.sin(a),
      nx: Math.cos(a),
      nz: Math.sin(a),
      cu: 0,
      hu: rt,
      hv: rt,
      r: rt * 0.97,
    })
  }
  const tube: Tube = { kind: 'tube', samples: capTube(samples, 'round') }
  return { shapes: [tube, neck] as Shape[], seat: seatFor(neckR - 0.9, neckR - 0.9) }
}

// ---------------------------------------------------------------- tubes

/** Turns a path of samples into a closed tube: each end a filleted flat face, or a round dome. */
export function capTube(
  samples: TubeSample[],
  end: 'flat' | 'round',
  sides: 'both' | 'end' = 'both',
  fillet = 0.9,
): TubeSample[] {
  const close = (first: boolean): TubeSample[] => {
    const s = first ? samples[0]! : samples[samples.length - 1]!
    const nb = first ? samples[1]! : samples[samples.length - 2]!
    let tx = s.x - nb.x
    let tz = s.z - nb.z
    const tl = Math.hypot(tx, tz) || 1
    tx /= tl
    tz /= tl
    const out: TubeSample[] = []
    const at = (d: number, inset: number, scale = 1): TubeSample => ({
      ...s,
      x: s.x + tx * d,
      z: s.z + tz * d,
      hu: Math.max(0, (s.hu - inset) * scale),
      hv: Math.max(0, (s.hv - inset) * scale),
      r: Math.max(0, (s.r - inset) * scale),
    })
    if (end === 'round') {
      const rad = Math.min(s.hu, s.hv)
      for (let i = 1; i <= 6; i++) {
        const a = (Math.PI / 2) * (i / 6)
        out.push(at(rad * Math.sin(a), 0, Math.cos(a)))
      }
    } else {
      const f = Math.min(fillet, 0.45 * Math.min(s.hu, s.hv), s.r)
      for (let i = 1; i <= 3; i++) {
        const a = (Math.PI / 2) * (i / 3)
        out.push(at(f * Math.sin(a), f * (1 - Math.cos(a))))
      }
      out.push(at(f, f, 0.5))
      out.push(at(f, f, 0))
    }
    return first ? out.reverse() : out
  }
  return [...(sides === 'both' ? close(true) : []), ...samples, ...close(false)]
}

const sphereAt = (d: number, centre: number, r: number) =>
  Math.sqrt(Math.max(0, r * r - (d - centre) ** 2))

/** Carries a tube's last section on along `dir` into a round finial of radius rho(d), closing at `len`. */
export function endBulb(
  last: TubeSample,
  dir: Pt,
  len: number,
  rho: (d: number) => number,
): TubeSample[] {
  const out: TubeSample[] = []
  const n = 24
  for (let i = 1; i <= n; i++) {
    const t = i / n
    const d = len * (1 - Math.cos((Math.PI / 2) * t) * 0.35 - 0.65 * (1 - t))
    const rr = i === n ? 0 : rho(d)
    const fade = 1 - smoothstep(0.15 * len, 0.6 * len, d)
    const soft = (a: number) => Math.pow(a ** 4 + rr ** 4, 0.25)
    const hu = soft(last.hu * fade)
    const hv = soft(last.hv * fade)
    const w = clamp(rr / Math.max(1e-6, Math.max(hu, hv)), 0, 1)
    out.push({
      ...last,
      x: last.x + dir[0] * d,
      z: last.z + dir[1] * d,
      cu: last.cu * fade,
      hu: i === n ? 0 : hu,
      hv: i === n ? 0 : hv,
      r: i === n ? 0 : lerp(last.r * fade, 0.97 * Math.min(hu, hv), w),
    })
  }
  return out
}

/** Samples along a polyline path (already smooth), with normals from its tangent. */
function alongPath(
  path: Pt[],
  size: (i: number) => Pick<TubeSample, 'hu' | 'hv' | 'r' | 'cu'>,
): TubeSample[] {
  return path.map(([x, z], i) => {
    const a = path[Math.max(0, i - 1)]!
    const b = path[Math.min(path.length - 1, i + 1)]!
    const tx = b[0] - a[0]
    const tz = b[1] - a[1]
    const l = Math.hypot(tx, tz) || 1
    return { x, z, nx: -tz / l, nz: tx / l, ...size(i) }
  })
}

/** Resamples a polyline evenly, keeping its ends. */
function resample(path: Pt[], step: number): Pt[] {
  const out: Pt[] = [path[0]!]
  let carry = 0
  for (let i = 1; i < path.length; i++) {
    const [x0, z0] = path[i - 1]!
    const [x1, z1] = path[i]!
    const l = Math.hypot(x1 - x0, z1 - z0)
    let d = step - carry
    while (d < l) {
      out.push([x0 + ((x1 - x0) * d) / l, z0 + ((z1 - z0) * d) / l])
      d += step
    }
    carry = l - (d - step)
  }
  const last = path[path.length - 1]!
  const prev = out[out.length - 1]!
  if (Math.hypot(last[0] - prev[0], last[1] - prev[1]) < step * 0.4) out.pop()
  out.push(last)
  return out
}

// ---------------------------------------------------------------- guards

interface GuardLayout {
  shapes: Shape[]
  seat: Seat
  block: HiltLayout['block']
}

function guardLayout(spec: SwordSpec, gems: GemSite[]): GuardLayout {
  const { guard, grip } = spec
  const [edgeW, backW] = bladeHalfWidths(spec)
  const T = bladeHalfThickness(spec)
  const gr = sample(grip.radius, 1)
  const gry = gr * grip.oval
  const th = guard.thickness
  const barHu = 0.5 * th
  const barHv = 0.42 * th
  const gemOn = spec.gems.find((g) => g.at === 'guard')

  if (guard.style === 'disc') return discGuard(spec, gems, gemOn)
  if (guard.style === 'dome') {
    const R = guard.span / 2
    const oval = 0.8
    const topR = gr + 2
    const D = guard.to - guard.from
    const soft = Math.min(8, 0.3 * R)
    const profile = rounded(
      [
        [0, guard.to, 0],
        [R, guard.to, 1.2],
        [R, guard.to - 0.18 * D, soft],
        [lerp(R, topR, 0.55), guard.from + 0.42 * D, soft],
        [topR + 1, guard.from + 1.5, 2],
        [topR, guard.from, 0.7],
        [0, guard.from, 0],
      ],
      6,
    )
    return {
      shapes: [{ kind: 'lathe', profile, oval, facets: 0 }],
      seat: seatFor(topR - 1, topR * oval - 1),
      block: null,
    }
  }

  const blockFrom = guard.from
  const blockTo = guard.to
  const hx = Math.max(Math.max(edgeW, backW) + 3, gr + 1.5)
  const hy = Math.max(barHv, T + 2.2, 0.75 * gry + 1.4)
  const zc = (guard.from + guard.to) / 2
  const block = { hx, hy, from: blockFrom, to: blockTo }
  const shapes: Shape[] = []
  if (gemOn) {
    // An escutcheon: a shield-shaped plate over the block and the blade's base, holding the stone.
    const seat = gemOn.radius
    const outer = seat * (gemOn.cut === 'marquise' ? 1.45 : 1) + bezelRim(seat)
    const rx = Math.max(outer + 2.5, 0.6 * hx)
    const rz = outer + 2.5
    const cz = guard.from + rz - 1.5
    const point = 0.55 * rz
    const inside = (x: number, z: number) => {
      const below = Math.max(0, z) / (rz + point)
      const half = z > 0 ? rx * (1 - below ** 1.6) : rx
      return (
        Math.abs(x / Math.max(half, 1e-6)) ** 2.4 +
          Math.abs(z / (z > 0 ? rz + point : rz)) ** 2.4 <=
        1
      )
    }
    const th = hy + 0.7
    shapes.push({
      kind: 'plate',
      centre: [0, 0, cz],
      normal: 'y',
      outline: polar(inside, 112, 3 * rz),
      profile: plateProfile(
        [
          [0, -th, 0],
          [0.72 * rz, -th, 0.8],
          [rz, -th + 1.4, 0.8],
          [rz, th - 1.4, 0.8],
          [0.72 * rz, th, 0.8],
          [0, th, 0],
        ],
        rz,
      ),
    })
    gems.push({
      at: 'guard',
      position: [0, th, cz],
      normal: [0, 1, 0],
      along: [0, 0, 1],
      seat,
      sink: Math.min(0.56 * seat + 0.8, 2 * th - 0.8),
    })
  }
  const seat = seatFor(Math.min(hx, gr + 1.5) - 1.2, hy - 1.2)
  const blockSection = { hu: (blockTo - blockFrom) / 2, hv: hy, cu: (blockFrom + blockTo) / 2 - zc }

  if (guard.style === 'knuckleBow' || guard.style === 'swept' || guard.style === 'cup') {
    shapes.push(...hiltBars(spec, { zc, hx, hy, barHu, barHv, blockSection }))
  } else {
    shapes.push(...crossBar(spec, { zc, hx, barHu, barHv, blockSection }))
  }
  return { shapes, seat, block }
}

interface BarSizes {
  zc: number
  hx: number
  barHu: number
  barHv: number
  blockSection: { hu: number; hv: number; cu: number }
}

/** The cross guards: one bar through a centre block, bent, swept or winged, with its ends. */
function crossBar(spec: SwordSpec, b: BarSizes): Shape[] {
  const { guard } = spec
  const H = guard.span / 2
  const { zc, hx, barHu, barHv, blockSection } = b
  const reachOf = (x: number) => clamp((Math.abs(x) - hx) / (H - hx), 0, 1)
  const bendAt = (x: number) => {
    const t = reachOf(x)
    const side = guard.style === 'sCurve' ? Math.sign(x) : 1
    return side * guard.sweep * t * t
  }
  const winged = guard.style === 'winged'
  const round = guard.style === 'curved' || guard.style === 'sCurve'
  const ends = guard.ends
  const endHu = barHu * (winged ? 1.75 : 0.78)
  const endHv = barHv * (winged ? 0.62 : 0.78)
  const knobR = Math.max(4, 1.3 * Math.max(endHu, endHv))
  const endLen = ends === 'knobs' ? 1.85 * knobR : ends === 'drops' ? 2.6 * knobR : 0
  const barEnd = ends === 'curls' ? H - 2.2 * Math.max(endHu, 5) : H - endLen
  const ts: number[] = []
  for (let x = -barEnd; x <= barEnd + 1e-9;) {
    ts.push(x)
    const a = Math.abs(x)
    x += a < hx + 12 ? 1.2 : a > barEnd - 6 ? 0.8 : 3
  }
  if (ts[ts.length - 1]! < barEnd - 0.05) ts.push(barEnd)
  const transition = Math.max(6, 2 * (blockSection.hu - barHu))
  const sizeAt = (x: number) => {
    const t = reachOf(x)
    const w = smoothstep(hx - 2, hx + transition, Math.abs(x))
    const flare = ends === 'flared' ? 1 + 0.55 * smoothstep(0.75, 1, t) : 1
    let hu = barHu * lerp(1, endHu / barHu, winged ? smoothstep(0.2, 0.9, t) : t) * flare
    let hv = barHv * lerp(1, endHv / barHv, t) * (ends === 'flared' ? lerp(1, 0.8, t) : 1)
    hu = lerp(blockSection.hu, hu, w)
    hv = lerp(blockSection.hv, hv, w)
    const r = round ? 0.92 * Math.min(hu, hv) : Math.max(0.9, 0.3 * Math.min(hu, hv))
    return { hu, hv, r, cu: lerp(blockSection.cu, 0, w) }
  }
  const path: Pt[] = ts.map((x) => [x, zc + bendAt(x)])
  let samples = alongPath(path, (i) => sizeAt(ts[i]!))

  const endOf = (sign: 1 | -1): TubeSample[] => {
    const last = samples[sign > 0 ? samples.length - 1 : 0]!
    const tx = last.nz * sign
    const tz = -last.nx * sign
    const out: TubeSample[] = []
    if (ends === 'knobs')
      return endBulb(last, [tx, tz], endLen, (d) => sphereAt(d, endLen - knobR, knobR))
    if (ends === 'drops') {
      const ball = 1.1 * knobR
      const centre = endLen - ball
      return endBulb(last, [tx, tz], endLen, (d) =>
        Math.max(sphereAt(d, centre, ball), d < centre ? (d / centre) * ball * 0.62 : 0),
      )
    }
    if (ends === 'curls') {
      const R0 = Math.max(6, 2 * Math.max(endHu, endHv))
      const turn = 1.75 * Math.PI
      const n = 40
      let px = last.x
      let pz = last.z
      let ang = Math.atan2(tz, tx)
      const ds = (R0 * turn) / n / 1.3
      for (let i = 1; i <= n; i++) {
        const t = i / n
        const k = 1 / (R0 * lerp(1, 0.45, t))
        ang += -sign * k * ds
        px += Math.cos(ang) * ds
        pz += Math.sin(ang) * ds
        const scale = lerp(1, 0.55, t)
        out.push({
          x: px,
          z: pz,
          nx: -Math.sin(ang) * sign,
          nz: Math.cos(ang) * sign,
          cu: 0,
          hu: last.hu * scale,
          hv: last.hv * scale,
          r: last.r * scale,
        })
      }
      return out
    }
    return []
  }
  const right = endOf(1)
  const left = endOf(-1).reverse()
  samples = [...left, ...samples, ...right]
  const knobbed = ends === 'knobs' || ends === 'drops'
  const tube: Tube = {
    kind: 'tube',
    samples: knobbed ? samples : capTube(samples, ends === 'curls' ? 'round' : 'flat'),
  }
  const shapes: Shape[] = [tube]
  if (ends === 'fourLeaves') {
    for (const sign of [-1, 1]) {
      const s = sign > 0 ? samples[samples.length - 1]! : samples[0]!
      const leaf = 1.5 * Math.max(endHu, endHv) + 2
      const inside = (x: number, z: number) =>
        [0, 1, 2, 3].some((k) => {
          const a = (k * Math.PI) / 2 + Math.PI / 4
          return (
            Math.hypot(x - Math.cos(a) * leaf * 0.72, z - Math.sin(a) * leaf * 0.72) <= leaf * 0.62
          )
        }) || Math.hypot(x, z) < leaf * 0.7
      const t = Math.max(1.6, endHv + 0.6)
      shapes.push({
        kind: 'plate',
        centre: [s.x + sign * (leaf * 0.55), 0, s.z],
        normal: 'y',
        outline: polar(inside, 96, leaf * 2),
        profile: plateProfile(
          [
            [0, -t, 0],
            [leaf * 0.9, -t, 0.6],
            [leaf * 1.4, 0, 0],
            [leaf * 0.9, t, 0.6],
            [0, t, 0],
          ].map(([s0, t0, f]): [number, number, number] => [s0!, t0!, f!]),
          leaf * 1.4,
        ),
      })
    }
  }
  return shapes
}

/** Hilts with bars: the Sabre's hand bow, the Rapier's swept and cup hilts. */
function hiltBars(spec: SwordSpec, b: BarSizes & { hy: number }): Shape[] {
  const { guard, grip, pommel } = spec
  const { zc, hx, barHu, barHv, blockSection } = b
  const gr = Math.max(...grip.radius.map(([, r]) => r))
  const shapes: Shape[] = []
  const bowX = clamp(0.25 * guard.span, gr + 24, gr + 38)
  const bowHu = Math.max(2.4, 0.32 * barHu)
  const bowHv =
    guard.style === 'knuckleBow' ? Math.max(5, 0.75 * barHv * 1.6) : Math.max(2.6, 0.5 * barHv)
  const sabre = guard.style === 'knuckleBow'
  const endZ = pommel.to * 0.55
  const endX = Math.min(pommel.radius * 0.5, gr * 0.6)

  // The bar: back quillon (sabre) or both quillons (rapier), through the block, out to the bow.
  const H = sabre ? 0.3 * guard.span : guard.span / 2
  const back: Pt[] = [
    [-H, zc + (sabre ? -0.08 * H : 0)],
    [-hx - 6, zc],
  ]
  const corners: [number, number, number][] = sabre
    ? [
        [back[0]![0], back[0]![1], 0],
        [back[1]![0], back[1]![1], 10],
        [bowX, zc, 18],
        [bowX, endZ + 22, 16],
        [endX, endZ, 0],
      ]
    : [
        [-H, zc, 0],
        [H, zc, 0],
      ]
  const barPath = resample(rounded(corners, 10), 1.5)
  const blockEnd = hx + Math.max(6, 2 * (blockSection.hu - barHu))
  const bar = alongPath(barPath, (i) => {
    const [x, z] = barPath[i]!
    const onBlock = Math.abs(z - zc) < 1 ? smoothstep(blockEnd, hx - 2, Math.abs(x)) : 0
    const toBow = sabre ? smoothstep(bowX - 25, bowX, x) * (x > 0 ? 1 : 0) : 0
    const quillon = sabre && x < 0 ? lerp(1, 0.7, clamp((-x - hx) / (H - hx), 0, 1)) : 1
    let hu = lerp(barHu * 0.75 * quillon, bowHu, toBow)
    let hv = lerp(barHv * quillon, bowHv, toBow)
    if (!sabre) {
      const t = clamp((Math.abs(x) - hx) / (H - hx), 0, 1)
      hu = barHu * lerp(0.8, 0.6, t)
      hv = barHv * lerp(0.9, 0.65, t)
    }
    hu = lerp(hu, blockSection.hu, onBlock)
    hv = lerp(hv, blockSection.hv, onBlock)
    return {
      hu,
      hv,
      r: 0.9 * Math.min(hu, hv),
      cu: blockSection.cu * onBlock,
    }
  })
  // Sabre: the bow's end is buried in the pommel; the quillon ends in a knob.
  const knobbed = (samples: TubeSample[], atStart: boolean, size: number) => {
    const s = atStart ? samples[0]! : samples[samples.length - 1]!
    const nb = atStart ? samples[1]! : samples[samples.length - 2]!
    const l = Math.hypot(s.x - nb.x, s.z - nb.z) || 1
    const len = 1.85 * size
    const extra = endBulb(s, [(s.x - nb.x) / l, (s.z - nb.z) / l], len, (d) =>
      sphereAt(d, len - size, size),
    )
    return atStart ? [...extra.reverse(), ...samples] : [...samples, ...extra]
  }
  const knob = Math.max(4, 1.3 * barHv)
  if (sabre) {
    const withKnob = knobbed(bar, true, knob)
    shapes.push({ kind: 'tube', samples: capTube(withKnob, 'round', 'end') })
  } else {
    shapes.push({ kind: 'tube', samples: knobbed(knobbed(bar, true, knob), false, knob) })
    // The bow, from the block out round the hand to the pommel.
    const bowPath = resample(
      rounded(
        [
          [hx * 0.4, zc, 0],
          [bowX, zc, 18],
          [bowX, endZ + 22, 16],
          [endX, endZ, 0],
        ],
        10,
      ),
      1.5,
    )
    const bow = alongPath(bowPath, () => ({
      hu: bowHu,
      hv: bowHv,
      r: 0.92 * Math.min(bowHu, bowHv),
      cu: 0,
    }))
    shapes.push({ kind: 'tube', samples: capTube(bow, 'round') })
    if (guard.style === 'swept') {
      const [edgeW] = bladeHalfWidths(spec)
      for (const sign of [-1, 1]) {
        const x0 = edgeW + 3
        const loop = resample(
          rounded(
            [
              [sign * (hx - 1.5), guard.to - 2, 0],
              [sign * x0, guard.to + 0.65 * guard.sweep, 9],
              [sign * (x0 + 16), guard.to + guard.sweep, 9],
              [sign * (x0 + 30), zc + 2, 0],
            ],
            10,
          ),
          1.5,
        )
        const ring = alongPath(loop, () => ({
          hu: bowHu * 0.9,
          hv: bowHu * 0.9,
          r: 0.95 * bowHu * 0.9,
          cu: 0,
        }))
        shapes.push({ kind: 'tube', samples: capTube(ring, 'round') })
      }
    }
    if (guard.style === 'cup') shapes.push(...cupShell(spec))
  }
  return shapes
}

function cupShell(spec: SwordSpec): Shape[] {
  const { guard, grip } = spec
  const R = guard.span / 2
  const depth = guard.to - guard.from
  const wall = Math.max(2, guard.thickness)
  const bead = 1.6
  const outer: [number, number, number][] = []
  const inner: [number, number, number][] = []
  const n = 22
  for (let i = 0; i <= n; i++) {
    const a = (Math.PI / 2) * (i / n)
    outer.push([R * Math.sin(a), guard.to - depth * (1 - Math.cos(a)), 0])
  }
  for (let i = n; i >= 0; i--) {
    const a = (Math.PI / 2) * (i / n)
    inner.push([(R - wall) * Math.sin(a), guard.to - wall - (depth - wall) * (1 - Math.cos(a)), 0])
  }
  const rim: [number, number, number][] = []
  for (let i = 1; i < 8; i++) {
    const a = Math.PI * (i / 8)
    rim.push([
      R - wall / 2 + (bead - 0) * Math.sin(a) * 0.6 + (wall / 2) * Math.cos(a),
      guard.from - bead * Math.sin(a) * 0.4,
      0,
    ])
  }
  const profile = rounded([...outer, ...rim, ...inner], 4)
  const gr = sample(grip.radius, 1)
  const socket = rounded(
    [
      [0, guard.from - 0.5, 0],
      [gr + 1.6, guard.from - 0.5, 0.8],
      [gr + 1.6, guard.to - wall + 2, 0],
      [0, guard.to - wall + 2, 0],
    ],
    4,
  )
  return [
    { kind: 'lathe', profile, oval: 1, facets: 0 },
    { kind: 'lathe', profile: socket, oval: grip.oval, facets: 0 },
  ]
}

function discGuard(
  spec: SwordSpec,
  gems: GemSite[],
  gemOn: SwordSpec['gems'][number] | undefined,
): GuardLayout {
  const { guard, grip } = spec
  const R = guard.span / 2
  const ry = 0.93
  const shape = guard.discShape ?? 'round'
  const inside = (x: number, y: number) => {
    const [u, v] = [x / R, y / (R * ry)]
    if (shape === 'roundedSquare') return Math.abs(u) ** 3.4 + Math.abs(v) ** 3.4 <= 1
    if (shape === 'flower') {
      const a = Math.atan2(v, u)
      const rho = 1 - 0.14 * (1 - Math.abs(Math.cos(2 * a))) ** 2.2
      return Math.hypot(u, v) <= rho
    }
    return Math.hypot(u, v) <= 1
  }
  const outline = polar(inside, shape === 'flower' ? 160 : 112, 2 * R)
  const from = guard.from
  const to = guard.to
  const mid = (from + to) / 2
  const half = (to - from) / 2
  const sink = 0.35
  const profile = plateProfile(
    [
      [0, -half + sink, 0],
      [0.86 * R, -half + sink, 0.6],
      [R - 1.6, -half, 0.6],
      [R, -half + 1.1, 0.7],
      [R, half - 1.1, 0.7],
      [R - 1.6, half, 0.6],
      [0.86 * R, half - sink, 0.6],
      [0, half - sink, 0],
    ],
    R,
  )
  const tsuba: Plate = { kind: 'plate', centre: [0, 0, mid], normal: 'z', outline, profile }
  const gr = sample(grip.radius, 1)
  const [edgeW, backW] = bladeHalfWidths(spec)
  const T = bladeHalfThickness(spec)
  // Seppa: thin oval washers either side, a little wider than the collar and the grip's end.
  const washer = (z0: number, z1: number, rx: number, rv: number): Plate => {
    const w = (z1 - z0) / 2
    return {
      kind: 'plate',
      centre: [(edgeW - backW) / 2, 0, (z0 + z1) / 2],
      normal: 'z',
      outline: polar((x, y) => Math.hypot(x / rx, y / rv) <= 1, 64, 2 * rx),
      profile: plateProfile(
        [
          [0, -w, 0],
          [rx, -w, 0.4],
          [rx, w, 0.4],
          [0, w, 0],
        ],
        rx,
      ),
    }
  }
  const collarX = Math.max(edgeW, backW) + 3.4
  const shapes: Shape[] = [
    tsuba,
    washer(from - 1.2, from + 0.6, gr + 2.2, gr * grip.oval + 2),
    washer(to - 0.6, to + 1.2, collarX, T + 3.6),
  ]
  if (gemOn) {
    const seat = gemOn.radius
    gems.push({
      at: 'guard',
      position: [0, 0.5 * (R * ry + T + 3.6), to - sink],
      normal: [0, 0, 1],
      along: [0, 1, 0],
      seat,
      sink: Math.min(0.56 * seat + 0.8, 2 * half - sink - 0.6),
    })
  }
  return {
    shapes,
    seat: seatFor(R * 0.5, R * 0.5),
    block: null,
  }
}

/** Fittings on the grip: Turk's heads on a wire grip, a katana's fuchi. */
/** Where the grip comes out of the pommel along the axis: a plate's top edge, or the pommel's end. */
function pommelTop(shapes: Shape[], to: number): number {
  let top = to
  for (const s of shapes)
    if (s.kind === 'plate' && s.normal === 'y')
      for (const [x, z] of s.outline) if (Math.abs(x) < 2) top = Math.max(top, s.centre[2] + z)
  return top
}

function bandsFor(spec: SwordSpec, guardSeat: Seat, pommelSeat: Seat, fromTop: number): Shape[] {
  const { grip, guard } = spec
  const relief = wrapRelief(spec)
  const band = (z0: number, z1: number, round: boolean): Lathe => {
    let rx = 0
    let ry = 0
    for (let k = 0; k <= 8; k++) {
      const z = lerp(z0, z1, k / 8)
      const [cx, cy] = coreAt(spec, z, guardSeat, pommelSeat)
      const lift = relief * reliefFade(spec, z)
      rx = Math.max(rx, cx + lift)
      ry = Math.max(ry, cy + lift)
    }
    const r = rx + (round ? 1.4 : 0.7)
    const f = round ? (z1 - z0) * 0.45 : 0.7
    return {
      kind: 'lathe',
      profile: rounded(
        [
          [0, z0, 0],
          [r - (round ? 0.6 : 0), z0, f],
          [r, (z0 + z1) / 2, round ? f : 0],
          [r - (round ? 0.6 : 0), z1, f],
          [0, z1, 0],
        ],
        5,
      ),
      oval: (ry + r - rx) / r,
      facets: 0,
    }
  }
  if (grip.wrap === 'wire')
    return [band(fromTop - 0.8, fromTop + 4, true), band(grip.to - 4, grip.to + 0.5, true)]
  if (grip.wrap === 'diamond' && guard.style === 'disc')
    return [band(grip.to - 12, guard.from + 0.4, false)]
  return []
}

// ---------------------------------------------------------------- the whole sword

/** The chord rotation that puts a curved sword's pommel end and tip on the z axis: [cos, sin]. */
export function chordRotation(spec: SwordSpec): [number, number] {
  const tip = centreLineAt(spec, spec.blade.to)
  const l = Math.hypot(tip.x, tip.z)
  return [tip.z / l, tip.x / l]
}

/** Edge-side and back-side half-widths of the blade at straight z, waves included. */
export function bladeWidthsAt(spec: SwordSpec, z: number): [edge: number, back: number] {
  const b = spec.blade
  const u = clamp((z - b.from) / (b.to - b.from), 0, 1)
  const edge0 = sample(b.halfWidth, u)
  const back0 = b.backWidth ? sample(b.backWidth, u) : edge0
  const w = b.wave
  let shift = 0
  if (w && z > w.from && z < w.to) {
    const half = w.lengthMm / 2
    const env = smoothstep(w.from, w.from + half, z) * (1 - smoothstep(w.to - half, w.to, z))
    shift = w.amp * (edge0 + back0) * env * Math.sin((TAU * (z - w.from)) / w.lengthMm)
  }
  return [Math.max(0, edge0 + shift), Math.max(0, back0 - shift)]
}

/** A shape's top-down silhouette in the straight frame, as closed (x, z) polygons. */
export function silhouetteOf(shape: Shape): Pt[][] {
  if (shape.kind === 'tube') {
    const s = shape.samples
    const hi = s.map((p): Pt => [p.x + p.nx * (p.cu + p.hu), p.z + p.nz * (p.cu + p.hu)])
    const lo = s.map((p): Pt => [p.x + p.nx * (p.cu - p.hu), p.z + p.nz * (p.cu - p.hu)])
    return [[...hi, ...lo.reverse()]]
  }
  if (shape.kind === 'lathe') {
    const right = shape.profile.map(([r, z]): Pt => [r, z])
    const left = shape.profile.map(([r, z]): Pt => [-r, z]).reverse()
    return [[...right, ...left]]
  }
  const [cx, cy, cz] = shape.centre
  void cy
  if (shape.normal === 'y') return [shape.outline.map(([x, z]): Pt => [cx + x, cz + z])]
  const xs = shape.outline.map(([x]) => x)
  const [lo, hi] = [Math.min(...xs), Math.max(...xs)]
  const right = shape.profile.map(([s, t]): Pt => [cx + s * hi, cz + t])
  const left = shape.profile.map(([s, t]): Pt => [cx + s * lo, cz + t]).reverse()
  return [[...right, ...left]]
}

/** The indices of a polygon's furthest points each way in x and z. */
function extremes(p: Pt[]): Set<number> {
  const best = [0, 0, 0, 0]
  p.forEach(([x, z], i) => {
    if (x > p[best[0]!]![0]) best[0] = i
    if (x < p[best[1]!]![0]) best[1] = i
    if (z > p[best[2]!]![1]) best[2] = i
    if (z < p[best[3]!]![1]) best[3] = i
  })
  return new Set(best)
}

/** Drops the points that change the outlines least (smallest corner triangles) until `budget` remain. */
function simplify(polys: Pt[][], budget: number): Pt[][] {
  const out = polys.map((p) => [...p])
  const corner = (p: Pt[], i: number) => {
    const [ax, ay] = p[(i + p.length - 1) % p.length]!
    const [bx, by] = p[i]!
    const [cx, cy] = p[(i + 1) % p.length]!
    return Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay))
  }
  for (let pass = 0; pass < 40; pass++) {
    const total = out.reduce((n, p) => n + p.length, 0)
    const excess = total - budget
    if (excess <= 0) break
    const all: { k: number; i: number; a: number }[] = []
    out.forEach((p, k) => {
      if (p.length <= 6) return
      const keep = extremes(p)
      for (let i = 0; i < p.length; i += 2) if (!keep.has(i)) all.push({ k, i, a: corner(p, i) })
    })
    if (all.length === 0) break
    all.sort((a, b) => a.a - b.a)
    const drop = all.slice(0, Math.max(1, Math.ceil(excess / 3)))
    const gone = out.map(() => new Set<number>())
    for (const d of drop) if (out[d.k]!.length - gone[d.k]!.size > 6) gone[d.k]!.add(d.i)
    out.forEach((p, k) => {
      out[k] = p.filter((_, i) => !gone[k]!.has(i))
    })
  }
  return out
}

const area = (poly: Pt[]) => {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i]!
    const [x1, y1] = poly[(i + 1) % poly.length]!
    a += x0 * y1 - x1 * y0
  }
  return a / 2
}

function bladeOutline(spec: SwordSpec): Pt[] {
  const b = spec.blade
  const B = b.to - b.from
  const zs: number[] = []
  const wave = b.wave
  const step = Math.max(4, B / 50)
  for (let z = b.from; z < b.to;) {
    zs.push(z)
    const u = (z - b.from) / B
    let dz = step
    if (wave && z > wave.from - 5 && z < wave.to + 5) dz = Math.min(dz, wave.lengthMm / 6)
    if (u > b.tipFrom - 0.02) dz = Math.min(dz, Math.max(1, (b.to - z) / 5, B / 120))
    z += dz
  }
  const edge: Pt[] = []
  const back: Pt[] = []
  for (const z of zs) {
    const line = centreLineAt(spec, z)
    const [c, s] = [Math.cos(line.angle), Math.sin(line.angle)]
    const [ew, bw] = bladeWidthsAt(spec, z)
    edge.push([line.x + c * ew, line.z + s * ew])
    back.push([line.x - c * bw, line.z - s * bw])
  }
  const tip = centreLineAt(spec, b.to)
  return [...edge, [tip.x, tip.z], ...back.reverse()]
}

function gripOutline(spec: SwordSpec): Pt[] {
  const { grip } = spec
  const right: Pt[] = []
  const n = 14
  const relief = wrapRelief(spec)
  for (let i = 0; i <= n; i++) {
    const z = lerp(grip.from - GRIP_OVERLAP, grip.to + GRIP_OVERLAP, i / n)
    right.push([gripCore(spec, z)[0] + relief * reliefFade(spec, z), z])
  }
  return [...right, ...right.map(([x, z]): Pt => [-x, z]).reverse()]
}

function collarOutline(spec: SwordSpec): Pt[] | null {
  if (!spec.collar) return null
  const { from, to } = spec.collar
  const [e0, b0] = bladeWidthsAt(spec, from)
  const [e1, b1] = bladeWidthsAt(spec, to)
  const grow = (k: number) => lerp(COLLAR_GROW[0], COLLAR_GROW[1], k)
  return [
    [e0 + grow(0), from - 1],
    [e1 + grow(1), to],
    [-(b1 + grow(1)), to],
    [-(b0 + grow(0)), from - 1],
  ]
}
/** Most points in a sword's outline. */
export const OUTLINE_POINTS = 380

/** How far the collar stands proud of the blade's sides at its guard end and its blade end, mm. */
export const COLLAR_GROW: [number, number] = [1.6, 1.1]

/** Every part's silhouette in the straight frame as (x, z) polygons, before thinning. */
export function silhouettes(spec: SwordSpec): Pt[][] {
  const layout = hiltLayout(spec)
  return [
    ...layout.pommel.flatMap(silhouetteOf),
    gripOutline(spec),
    ...layout.bands.flatMap(silhouetteOf),
    ...layout.guard.flatMap(silhouetteOf),
    ...[collarOutline(spec)].filter((p): p is Pt[] => p !== null),
    bladeOutline(spec),
  ]
}

/**
 * The sword seen from above as closed polylines of `[z, y]` in mm, every one wound the same
 * way: pommel end at z = 0 and the tip on the axis (a curved sword after its chord rotation),
 * y = -x (the edge at -y), so it lies as the stage draws it.
 */
export function swordOutline(spec: SwordSpec): [number, number][][] {
  const [c, s] = chordRotation(spec)
  const turned = silhouettes(spec).map((poly) => {
    const out = poly.map(([x, z]): Pt => [x * s + z * c, -(x * c - z * s)])
    return area(out) < 0 ? out.reverse() : out
  })
  return simplify(turned, OUTLINE_POINTS)
}
