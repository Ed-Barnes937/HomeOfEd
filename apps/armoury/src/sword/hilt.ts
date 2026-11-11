import { seatDistance } from '../wand/gems.ts'
import { centreLineAt } from './bend.ts'
import { bladeSectionAt } from './blade.ts'
import type { SwordSpec } from './compile.ts'
import {
  bezelRim,
  COLLAR_GROW,
  type GemSite,
  GRIP_OVERLAP,
  gripCore,
  hiltLayout,
  type Lathe,
  type Plate,
  type Pt,
  reliefFade,
  rounded,
  type Shape,
  type Tube,
  wrapRelief,
} from './outline.ts'
import { merge, type MeshPart, type Station, sweep, type Vec3 } from './sweep.ts'

// The hilt: guard, collar, grip, pommel, the grip's bands and the gems' settings, each a
// closed solid (or several) swept from the shapes in outline.ts. Every edge is filleted, so
// smooth normals are right everywhere.

const TAU = Math.PI * 2
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(...v) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

const LATHE_COLUMNS = 80
/** Points per quadrant of a rounded-rectangle section: axis, mid, 7 on the corner, mid. */
const ARC = 6
const QUAD = ARC + 4

// ---------------------------------------------------------------- sections

/** A rounded rectangle, half sizes a (u) and b (v), corner radius r: 40 points from -v, anticlockwise. */
function roundedRect(a: number, b: number, r: number): Float32Array {
  const out = new Float32Array(QUAD * 4 * 2)
  const m = Math.max(1e-4, Math.min(a, b))
  const rr = clamp(r, 0.02 * m, 0.97 * m)
  const [ia, ib] = [a - rr, b - rr]
  let k = 0
  const put = (u: number, v: number) => {
    out[k++] = u
    out[k++] = v
  }
  // Each quadrant: the point on the axis, one mid-side, the corner, the next mid-side.
  const quads: [number, number, number, number][] = [
    [0, -1, 1, -1],
    [1, 0, 1, 1],
    [0, 1, -1, 1],
    [-1, 0, -1, -1],
  ]
  quads.forEach(([ax, ay, cx, cy], q) => {
    put(ax * a, ay * b)
    if (ay !== 0) put(cx * ia * 0.5, ay * b)
    else put(ax * a, cy * ib * 0.5)
    const start = -Math.PI / 2 + (q * Math.PI) / 2
    for (let i = 0; i <= ARC; i++) {
      const t = start + ((Math.PI / 2) * i) / ARC
      put(cx * ia + rr * Math.cos(t) * Math.abs(cx), cy * ib + rr * Math.sin(t) * Math.abs(cy))
    }
    if (ay !== 0) put(cx * a, cy * ib * 0.5)
    else put(cx * ia * 0.5, cy * b)
  })
  return out
}

function ovalSection(rx: number, ry: number, n: number): Float32Array {
  const out = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (TAU * i) / n
    out[i * 2] = rx * Math.cos(a)
    out[i * 2 + 1] = ry * Math.sin(a)
  }
  return out
}

/** A regular polygon of apothem r with filleted corners, flats facing the axes, from the -v flat. */
function facetedSection(r: number, facets: number): Float32Array {
  const per = 6
  const out = new Float32Array(facets * per * 2)
  const half = Math.PI / facets
  const circum = r / Math.cos(half)
  const fillet = 0.22 * r * Math.tan(half)
  const inner = circum - fillet / Math.cos(half)
  let k = 0
  for (let f = 0; f < facets; f++) {
    const mid = -Math.PI / 2 + f * 2 * half
    // Two points on the flat, then the fillet round the next corner.
    for (const t of [0, 0.5]) {
      const along = (r * Math.tan(half) - fillet * Math.tan(half)) * t
      out[k++] = r * Math.cos(mid) - along * Math.sin(mid)
      out[k++] = r * Math.sin(mid) + along * Math.cos(mid)
    }
    const corner = mid + half
    for (let i = 0; i < 4; i++) {
      const a = corner - half + (2 * half * i) / 3
      out[k++] = inner * Math.cos(corner) + fillet * Math.cos(a)
      out[k++] = inner * Math.sin(corner) + fillet * Math.sin(a)
    }
  }
  return out
}

// ---------------------------------------------------------------- solids

/** Sweeps closed-ended stations into a solid wound outward, with the seam's normals joined. */
function solid(stations: Station[], exact = false): MeshPart {
  const part = sweep(stations, { capStart: 'apex', capEnd: 'apex', seam: true })
  // Exact-normal parts run along +z, which sweep already winds outward.
  if (exact) return part
  if (volumeSign(part) < 0) {
    const ix = part.indices
    for (let t = 0; t < ix.length; t += 3) {
      const b = ix[t + 1]!
      ix[t + 1] = ix[t + 2]!
      ix[t + 2] = b
    }
    for (let k = 0; k < part.normals.length; k++) part.normals[k] = -part.normals[k]!
  }
  // The seam's two columns share positions; give both the average normal.
  const n = stations[1]!.section.length / 2
  let v = 0
  stations.forEach((_, j) => {
    if (j === 0 || j === stations.length - 1) {
      v += 1
      return
    }
    const a = v * 3
    const b = (v + n) * 3
    const nx = part.normals[a]! + part.normals[b]!
    const ny = part.normals[a + 1]! + part.normals[b + 1]!
    const nz = part.normals[a + 2]! + part.normals[b + 2]!
    const l = Math.hypot(nx, ny, nz) || 1
    part.normals[a] = part.normals[b] = nx / l
    part.normals[a + 1] = part.normals[b + 1] = ny / l
    part.normals[a + 2] = part.normals[b + 2] = nz / l
    v += n + 1
  })
  return part
}

function volumeSign(part: MeshPart): number {
  const { positions: p, indices } = part
  let v = 0
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t]! * 3
    const b = indices[t + 1]! * 3
    const c = indices[t + 2]! * 3
    v +=
      p[a]! * (p[b + 1]! * p[c + 2]! - p[b + 2]! * p[c + 1]!) -
      p[a + 1]! * (p[b]! * p[c + 2]! - p[b + 2]! * p[c]!) +
      p[a + 2]! * (p[b]! * p[c + 1]! - p[b + 1]! * p[c]!)
  }
  return Math.sign(v)
}

/** Drops consecutive points that coincide, which would make zero-area faces. */
function distinct<T>(items: T[], key: (t: T) => number[]): T[] {
  const out: T[] = []
  for (const it of items) {
    const prev = out[out.length - 1]
    if (prev) {
      const a = key(prev)
      const b = key(it)
      if (Math.hypot(...a.map((x, i) => x - b[i]!)) < 1e-4) continue
    }
    out.push(it)
  }
  return out
}

function tubeSolid(tube: Tube): MeshPart {
  const samples = distinct(tube.samples, (s) => [s.x, s.z, s.hu, s.hv])
  let along = 0
  const stations = samples.map((s, i): Station => {
    if (i > 0) along += Math.hypot(s.x - samples[i - 1]!.x, s.z - samples[i - 1]!.z)
    return {
      centre: [s.x + s.nx * s.cu, 0, s.z + s.nz * s.cu],
      axisU: [s.nx, 0, s.nz],
      axisV: [0, 1, 0],
      section: roundedRect(Math.max(1e-3, s.hu), Math.max(1e-3, s.hv), s.r),
      uvAlong: along,
    }
  })
  return solid(stations)
}

function latheSolid(lathe: Lathe): MeshPart {
  const profile = distinct(lathe.profile, (p) => p)
  let along = 0
  const stations = profile.map(([r, z], i): Station => {
    if (i > 0) along += Math.hypot(r - profile[i - 1]![0], z - profile[i - 1]![1])
    return {
      centre: [0, 0, z],
      axisU: [1, 0, 0],
      axisV: [0, 1, 0],
      section:
        lathe.facets > 0
          ? facetedSection(Math.max(1e-3, r), lathe.facets)
          : ovalSection(Math.max(1e-3, r), Math.max(1e-3, r * lathe.oval), LATHE_COLUMNS),
      uvAlong: along,
    }
  })
  return solid(stations)
}

/** A plate's outline scaled along its profile, in the frame (e1, e2) with normal n. */
function plateStations(
  centre: Vec3,
  [e1, e2, n]: [Vec3, Vec3, Vec3],
  outline: Pt[],
  profile: Pt[],
): Station[] {
  const size = Math.max(...outline.map(([a, b]) => Math.hypot(a, b)))
  const points = distinct(profile, (p) => [p[0] * size, p[1]])
  let along = 0
  return points.map(([s, t], i): Station => {
    if (i > 0) along += Math.hypot((s - points[i - 1]![0]) * size, t - points[i - 1]![1])
    const section = new Float32Array(outline.length * 2)
    const k = Math.max(s, 1e-4)
    outline.forEach(([a, b], j) => {
      section[j * 2] = a * k
      section[j * 2 + 1] = b * k
    })
    return {
      centre: [centre[0] + n[0] * t, centre[1] + n[1] * t, centre[2] + n[2] * t],
      axisU: e1,
      axisV: e2,
      section,
      uvAlong: along,
    }
  })
}

function plateSolid(plate: Plate): MeshPart {
  const frame: [Vec3, Vec3, Vec3] =
    plate.normal === 'y'
      ? [
          [1, 0, 0],
          [0, 0, 1],
          [0, 1, 0],
        ]
      : [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ]
  return solid(plateStations(plate.centre, frame, plate.outline, plate.profile))
}

const shapeSolid = (shape: Shape): MeshPart =>
  shape.kind === 'tube'
    ? tubeSolid(shape)
    : shape.kind === 'lathe'
      ? latheSolid(shape)
      : plateSolid(shape)

/** Darkens a part where it meets another (`aShade`): within `run` mm of each crease plane z, inside its footprint. */
function withShade(
  part: MeshPart,
  creases: { z: number; rx: number; ry: number; run?: number }[],
  base?: (x: number, y: number, z: number) => number,
): MeshPart {
  const p = part.positions
  const shade = new Float32Array(p.length / 3)
  for (let v = 0; v < shade.length; v++) {
    const [x, y, z] = [p[v * 3]!, p[v * 3 + 1]!, p[v * 3 + 2]!]
    let s = base ? base(x, y, z) : 1
    for (const c of creases) {
      const near = smoothstep(c.run ?? 2.5, 0, Math.abs(z - c.z))
      const inside = smoothstep(2, 0, Math.max(Math.abs(x) - c.rx, Math.abs(y) - c.ry, 0))
      s = Math.min(s, 1 - 0.4 * near * inside)
    }
    shade[v] = s
  }
  part.attrs = { aShade: shade }
  return part
}

// ---------------------------------------------------------------- the parts

/** The guard: its bars, block, plates and any langets, as closed solids. */
export function guardPart(spec: SwordSpec): MeshPart {
  const layout = hiltLayout(spec)
  const parts = layout.guard.map(shapeSolid)
  if (spec.guard.langets > 0) parts.push(...langetSolids(spec))
  const [gx, gy] = gripCore(spec, spec.grip.to)
  const section = bladeSectionAt(spec, spec.blade.from)
  return withShade(merge(parts), [
    { z: spec.guard.from, rx: gx, ry: gy },
    {
      z: spec.blade.from,
      rx: Math.max(section.edge.width, section.back.width),
      ry: section.T,
    },
  ])
}

/** A katana's collar (habaki): a sleeve on the blade, standing proud of it, filleted at its blade end. */
export function collarPart(spec: SwordSpec): MeshPart | null {
  const c = spec.collar
  if (!c) return null
  const cols = 64
  const zs: number[] = []
  const z0 = c.from - GRIP_OVERLAP
  const len = c.to - z0
  for (let i = 0; i <= 10; i++) zs.push(z0 + (len - 1.2) * (i / 10))
  const fillet = 1
  const stations: Station[] = []
  const at = (z: number, inset: number, scale: number, uv: number): Station => {
    const line = centreLineAt(spec, z)
    const s = bladeSectionAt(spec, Math.max(z, spec.blade.from))
    const grow =
      lerp(COLLAR_GROW[0], COLLAR_GROW[1], clamp((z - c.from) / (c.to - c.from), 0, 1)) - inset
    const mid = (s.edge.width - s.back.width) / 2
    const span = (s.edge.width + s.back.width) / 2 + grow
    const section = new Float32Array(cols * 2)
    for (let i = 0; i < cols; i++) {
      const a = -Math.PI / 2 + (TAU * i) / cols
      const x = mid + span * Math.cos(a)
      const xb = clamp(x, -s.back.width, s.edge.width)
      const h = Math.max(s.half(xb), 0.2) + grow
      const y = h * Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.28)
      section[i * 2] = x * scale
      section[i * 2 + 1] = y * scale
    }
    return {
      centre: [line.x, 0, line.z],
      axisU: [Math.cos(line.angle), 0, Math.sin(line.angle)],
      axisV: [0, 1, 0],
      section,
      uvAlong: uv,
    }
  }
  stations.push(at(z0, 0, 1, 0))
  for (const z of zs) stations.push(at(z, 0, 1, z - z0))
  for (let i = 1; i <= 3; i++) {
    const a = (Math.PI / 2) * (i / 3)
    const z = c.to - fillet + fillet * Math.sin(a)
    stations.push(at(z, fillet * (1 - Math.cos(a)), 1, z - z0))
  }
  stations.push(at(c.to, fillet, 0.55, len + 2))
  stations.push(at(c.to, fillet, 0, len + 4))
  const part = solid(stations)
  const T = bladeSectionAt(spec, c.from).T
  return withShade(part, [{ z: c.from, rx: 1e3, ry: T + 4 }])
}

/** Langets: two tongues lying on the blade's flats below the guard, feathered into its faces. */
function langetSolids(spec: SwordSpec): MeshPart[] {
  const L = spec.guard.langets
  // Starts inside the guard's block, so no step shows where the tongue leaves it.
  const z0 = spec.blade.from - 4
  const z1 = spec.blade.from + L
  const base = spec.blade.halfWidth[0]![1]
  const w0 = 0.3 * base
  const thick = 1.2
  const n = 16
  const out: MeshPart[] = []
  for (const side of [1, -1]) {
    const stations: Station[] = []
    const body = Math.max(8, Math.ceil((0.7 * L) / 3))
    const ts: number[] = []
    for (let j = 0; j < body; j++) ts.push((0.7 * j) / body)
    for (let k = 0; k <= 10; k++) ts.push(0.7 + 0.3 * Math.sin((Math.PI / 2) * (k / 10)))
    for (const t of ts) {
      const z = lerp(z0, z1, t)
      const w = w0 * lerp(1, 0.7, Math.min(1, t / 0.7))
      // The tongue thins flush with the blade, then closes round to a point on its face.
      const end = clamp((t - 0.7) / 0.3, 0, 1)
      const g = Math.cos(Math.asin(end))
      const lift = thick * (1 - smoothstep(0, 0.6, end))
      const centre = -0.19
      const s = bladeSectionAt(spec, Math.max(z, spec.blade.from))
      const line = centreLineAt(spec, z)
      const mid = s.half(0)
      const section = new Float32Array(n * 2 * 2)
      let k = 0
      // Hugs the blade's face at the narrowed x; only the tongue's own thickness closes up.
      const put = (x: number, offset: number) => {
        const xs = x * g
        section[k++] = xs
        section[k++] = side * (s.half(xs) - mid + (offset - centre) * g)
      }
      for (let i = 0; i < n; i++) put(-w + (2 * w * i) / (n - 1), -0.4)
      for (let i = n - 1; i >= 0; i--) {
        const x = -w + (2 * w * i) / (n - 1)
        // Sloped sides, so the tongue reads as forged, not a slab.
        put(x, lift * Math.max(0, 1 - (x / w) ** 2) ** 0.7 + 0.02)
      }
      stations.push({
        centre: [line.x, side * (mid + centre), line.z],
        axisU: [Math.cos(line.angle), 0, Math.sin(line.angle)],
        axisV: [0, 1, 0],
        section,
        uvAlong: z - z0,
      })
    }
    out.push(solid(stations))
  }
  return out
}

/** The pommel, seated over the grip's end. */
export function pommelPart(spec: SwordSpec): MeshPart {
  const layout = hiltLayout(spec)
  const seat = layout.pommelSeat
  return withShade(merge(layout.pommel.map(shapeSolid)), [
    { z: spec.pommel.to, rx: seat.x + 0.6, ry: seat.y + 0.6 },
  ])
}

/** Bands round the grip (Turk's heads, a fuchi), or null. */
export function bandsPart(spec: SwordSpec): MeshPart | null {
  const { bands } = hiltLayout(spec)
  if (bands.length === 0) return null
  return withShade(merge(bands.map(shapeSolid)), [])
}

/** The gems' raised settings, cupped to hold each stone a little above its seat. */
export function gemSettingsPart(spec: SwordSpec): MeshPart | null {
  const { gems } = hiltLayout(spec)
  if (gems.length === 0) return null
  const parts = gems.map((site) => {
    const gem = spec.gems.find((g) => g.at === site.at)!
    return withShade(bezelSolid(site, gem.cut), [], (x, y, z) => {
      const [px, py, pz] = site.position
      const [nx, ny, nz] = site.normal
      const t = (x - px) * nx + (y - py) * ny + (z - pz) * nz
      return 1 - 0.3 * smoothstep(-0.2, -0.9, t)
    })
  })
  return merge(parts)
}

function bezelSolid(site: GemSite, cut: SwordSpec['gems'][number]['cut']): MeshPart {
  const seat = site.seat
  const n = unit(site.normal)
  const e2 = unit(site.along)
  const e1 = unit(cross(e2, n))
  const unitGem = { theta: 0, z: 0, radius: 1, cut }
  const outline: Pt[] = []
  const N = 48
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (TAU * i) / N
    const [c, s] = [Math.cos(a), Math.sin(a)]
    let lo = 0
    let hi = 2
    for (let k = 0; k < 22; k++) {
      const mid = (lo + hi) / 2
      if (seatDistance(unitGem, c * mid, s * mid) < 0) lo = mid
      else hi = mid
    }
    outline.push([c * lo, s * lo])
  }
  const rim = bezelRim(seat)
  const top = 0.16 * seat + 0.2
  const floor = -0.56 * seat
  const out = seat + rim
  const profile = rounded(
    [
      [0, -site.sink, 0],
      [out, -site.sink, 0],
      [out, top, 0.45 * rim],
      [seat * 0.97, top, 0.35 * rim],
      [seat * 0.97, floor, 0.3],
      [0, floor, 0],
    ],
    4,
  ).map(([s, t]): Pt => [s, t])
  return solid(plateStations(site.position, [e1, e2, n], outline, profile))
}

// ---------------------------------------------------------------- the grip

interface Wrapping {
  /** Ring spacing along the grip and columns round it. */
  step: number
  cols: number
  /** Writes [lift above the core (mm), 1 on the wrap or 0 on what shows under it, cavity shade]. */
  at: (theta: number, z: number, out: Float64Array) => void
}

function wrappingFor(spec: SwordSpec): Wrapping {
  const { grip } = spec
  const p = grip.pitchMm
  const span = grip.to - grip.from
  const top = wrapRelief(spec)
  const set = (out: Float64Array, lift: number, wrap: number, shade: number) => {
    out[0] = lift
    out[1] = wrap
    out[2] = shade
  }
  switch (grip.wrap) {
    case 'cord':
    case 'wire':
      return {
        step: p / (grip.wrap === 'wire' ? 5 : 8),
        cols: grip.wrap === 'wire' ? 40 : 56,
        at: (theta, z, out) => {
          const phase = (z - grip.from) / p + theta / TAU
          const f = phase - Math.floor(phase)
          const h = Math.sqrt(Math.max(0, 1 - (2 * f - 1) ** 2))
          set(out, top * h, 1, lerp(0.55, 1, h))
        },
      }
    case 'leather': {
      const risers = grip.risers.map((u) => grip.from + u * span)
      return {
        step: 1.2,
        cols: 72,
        at: (_, z, out) => {
          let h = 0
          for (const r of risers) {
            const d = Math.abs(z - r) / 4.5
            if (d < 1) h = Math.max(h, (1 + Math.cos(Math.PI * d)) / 2)
          }
          set(out, top * h, 1, 1)
        },
      }
    }
    case 'ribbed': {
      const grooves = [0.2, 0.4, 0.6, 0.8].map((u) => grip.from + u * span)
      return {
        step: 0.8,
        cols: 72,
        at: (_, z, out) => {
          let g = 0
          for (const c of grooves) {
            const d = Math.abs(z - c) / 3
            if (d < 1) g = Math.max(g, (1 + Math.cos(Math.PI * d)) / 2)
          }
          set(out, -1.5 * g, 1, 1 - 0.35 * g)
        },
      }
    }
    case 'diamond': {
      const band = (phase: number) => {
        const d = Math.abs(phase - Math.floor(phase) - 0.5)
        return smoothstep(0.355, 0.28, d)
      }
      return {
        step: 0.8,
        cols: 88,
        at: (theta, z, out) => {
          const a = theta - Math.PI / 2
          const along = (z - grip.from) / p
          const b1 = band(along + a / TAU)
          const b2 = band(along - a / TAU)
          const cover = Math.max(b1, b2)
          const over = b1 * b2
          const edge = cover * (1 - cover) * 4
          set(out, 1.1 * cover + 0.35 * over, cover, 1 - 0.3 * edge - 0.15 * over)
        },
      }
    }
    default:
      return { step: 2, cols: 72, at: (_, __, out) => set(out, 0, 1, 1) }
  }
}

/**
 * The grip: an oval core shaped along its length, its wrap as raised relief, tucked into its
 * fittings. Its normals come from the relief grid itself, so no triangle pass is needed.
 */
export function gripPart(spec: SwordSpec): MeshPart {
  const { grip } = spec
  const wrapping = wrappingFor(spec)
  const z0 = grip.from - GRIP_OVERLAP
  const z1 = grip.to + GRIP_OVERLAP
  const count = Math.max(8, Math.ceil((z1 - z0) / wrapping.step))
  const rings = count + 1
  const cols = wrapping.cols
  const dz = (z1 - z0) / count
  const dTheta = TAU / cols
  const cosT = new Float64Array(cols)
  const sinT = new Float64Array(cols)
  for (let i = 0; i < cols; i++) {
    cosT[i] = Math.cos(-Math.PI / 2 + i * dTheta)
    sinT[i] = Math.sin(-Math.PI / 2 + i * dTheta)
  }
  const h = new Float64Array(rings * cols)
  const rx = new Float64Array(rings)
  const ry = new Float64Array(rings)
  const out = new Float64Array(3)
  const stations: Station[] = []
  for (let j = 0; j < rings; j++) {
    const z = z0 + j * dz
    ;[rx[j], ry[j]] = gripCore(spec, z)
    const fade = reliefFade(spec, z)
    const aWrap = new Float32Array(cols)
    const aShade = new Float32Array(cols)
    for (let i = 0; i < cols; i++) {
      wrapping.at(-Math.PI / 2 + i * dTheta, z, out)
      h[j * cols + i] = out[0]! * fade
      aWrap[i] = out[1]!
      aShade[i] = lerp(1, out[2]!, fade)
    }
    const section = new Float32Array(cols * 2)
    for (let i = 0; i < cols; i++) {
      section[i * 2] = (rx[j]! + h[j * cols + i]!) * cosT[i]!
      section[i * 2 + 1] = (ry[j]! + h[j * cols + i]!) * sinT[i]!
    }
    stations.push({
      centre: [0, 0, z],
      axisU: [1, 0, 0],
      axisV: [0, 1, 0],
      section,
      uvAlong: z - grip.from,
      attrs: { aWrap, aShade },
    })
  }
  stations.forEach((station, j) => {
    const a = Math.max(0, j - 1)
    const b = Math.min(rings - 1, j + 1)
    const span = (b - a) * dz
    const drx = (rx[b]! - rx[a]!) / span
    const dry = (ry[b]! - ry[a]!) / span
    const normals = new Float32Array(cols * 3)
    for (let i = 0; i < cols; i++) {
      const here = h[j * cols + i]!
      const hTheta =
        (h[j * cols + ((i + 1) % cols)]! - h[j * cols + ((i + cols - 1) % cols)]!) / (2 * dTheta)
      const hZ = (h[b * cols + i]! - h[a * cols + i]!) / span
      const [c, sn] = [cosT[i]!, sinT[i]!]
      const tx = -(rx[j]! + here) * sn + hTheta * c
      const ty = (ry[j]! + here) * c + hTheta * sn
      const zx = (drx + hZ) * c
      const zy = (dry + hZ) * sn
      let nx = ty
      let ny = -tx
      let nz = tx * zy - ty * zx
      // The end rings also bound the hidden end faces: lean them halfway onto the axis.
      if (j === 0 || j === rings - 1) {
        const l = Math.hypot(nx, ny, nz)
        nx /= l
        ny /= l
        nz = nz / l + (j === 0 ? -1 : 1)
      }
      normals[i * 3] = nx
      normals[i * 3 + 1] = ny
      normals[i * 3 + 2] = nz
    }
    station.normals = normals
  })
  return solid(
    [
      { ...stations[0]!, normals: undefined },
      ...stations,
      { ...stations[rings - 1]!, normals: undefined },
    ],
    true,
  )
}
