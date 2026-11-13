// PotionSpec -> closed mesh arrays: the glass, the liquid, the stopper and the label, in
// millimetres, the axis z, the foot at z = 0. Three-free; only stage/ builds meshes from it.

import type { MeshPart, Vec3 } from '../sword/sweep.ts'
import type { PotionSpec } from './compile.ts'
import { bottleProfile, type BottleProfile, FIT_MM, type ProfilePoint } from './profile.ts'

export interface PotionMesh {
  glass: MeshPart
  liquid: MeshPart
  stopper: MeshPart
  label: MeshPart | null
}

/** The label faces the child, along -y. */
export const FRONT_ANGLE = -Math.PI / 2

const SEGMENTS = 64
const STOPPER_SEGMENTS = 40
const PAPER_BACK_MM = 0.3
const PAPER_FRONT_MM = 0.42
const PAPER_GRID_MM = 2
const ROUND_SHARE = 0.4
const ROUND_MAX_TURN = (100 * Math.PI) / 180
const BANNER_TURN = (140 * Math.PI) / 180
const BANNER_HALF_HEIGHT = 11
const BANNER_NOTCH = 5
const CARD_HALF_WIDTH = 13
const CARD_HALF_HEIGHT = 9
const CARD_HOLE_V = 6
const CARD_HALF_THICK = 0.2
const STRING_R = 0.5
const STRING_SIDES = 8
const STRING_STEP = 2
const DRIP_R = 1
const DRIP_FLAT = 0.7
const DRIPS: [angle: number, length: number][] = [
  [0.35, 4.5],
  [1.9, 7],
  [3.3, 3.5],
  [4.6, 6],
]

class Builder {
  private positions: number[] = []
  private normals: number[] = []
  private uvs: number[] = []
  private indices: number[] = []

  vertex(p: Vec3, n: Vec3, u: number, v: number): number {
    this.positions.push(p[0], p[1], p[2])
    this.normals.push(n[0], n[1], n[2])
    this.uvs.push(u, v)
    return this.positions.length / 3 - 1
  }

  /** A triangle wound to face the way its vertices' normals do; a degenerate one is dropped. */
  tri(a: number, b: number, c: number): void {
    const p = this.positions
    const n = this.normals
    const ux = p[b * 3]! - p[a * 3]!
    const uy = p[b * 3 + 1]! - p[a * 3 + 1]!
    const uz = p[b * 3 + 2]! - p[a * 3 + 2]!
    const vx = p[c * 3]! - p[a * 3]!
    const vy = p[c * 3 + 1]! - p[a * 3 + 1]!
    const vz = p[c * 3 + 2]! - p[a * 3 + 2]!
    const fx = uy * vz - uz * vy
    const fy = uz * vx - ux * vz
    const fz = ux * vy - uy * vx
    if (fx * fx + fy * fy + fz * fz < 1e-14) return
    let facing = 0
    for (const k of [a, b, c]) facing += fx * n[k * 3]! + fy * n[k * 3 + 1]! + fz * n[k * 3 + 2]!
    if (facing >= 0) this.indices.push(a, b, c)
    else this.indices.push(a, c, b)
  }

  /** A triangle already wound outward. */
  wound(a: number, b: number, c: number): void {
    this.indices.push(a, b, c)
  }

  part(): MeshPart {
    const positions = Float32Array.from(this.positions)
    return {
      positions,
      normals: Float32Array.from(this.normals),
      uvs: Float32Array.from(this.uvs),
      indices: Uint32Array.from(this.indices),
      attrs: { aHeight: positions.filter((_, i) => i % 3 === 2) },
    }
  }
}

const unit = (v: Vec3): Vec3 => {
  const len = Math.hypot(v[0], v[1], v[2])
  return [v[0] / len, v[1] / len, v[2] / len]
}

type Place = (r: number, z: number, nr: number, nz: number, angle: number) => [p: Vec3, n: Vec3]

const lathe: Place = (r, z, nr, nz, a) => {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [
    [r * c, r * s, z],
    [nr * c, nr * s, nz],
  ]
}

/** A closed profile turned about an axis; `place` puts each (r, z, angle) in the part's space. */
function revolve(b: Builder, curve: ProfilePoint[], segments: number, place: Place = lathe): void {
  let along = 0
  const rings = curve.map((pt, i) => {
    if (i > 0) along += Math.hypot(pt.r - curve[i - 1]!.r, pt.z - curve[i - 1]!.z)
    return Array.from({ length: segments + 1 }, (_, j) => {
      const [p, n] = place(pt.r, pt.z, pt.nr, pt.nz, ((j % segments) / segments) * 2 * Math.PI)
      return b.vertex(p, n, j / segments, along)
    })
  })
  for (let i = 1; i < rings.length; i++) {
    const lo = rings[i - 1]!
    const hi = rings[i]!
    for (let j = 0; j < segments; j++) {
      b.tri(lo[j]!, lo[j + 1]!, hi[j]!)
      b.tri(lo[j + 1]!, hi[j + 1]!, hi[j]!)
    }
  }
}

function lathePart(curves: ProfilePoint[][], segments: number): Builder {
  const b = new Builder()
  for (const curve of curves) revolve(b, curve, segments)
  return b
}

/** A small flattened ellipsoid hanging down the neck from under the wax cap. */
function drip(b: Builder, angle: number, top: number, length: number, neckR: number): void {
  const half = length / 2
  const centre = top - half
  const steps = 10
  const curve: ProfilePoint[] = Array.from({ length: steps + 1 }, (_, k) => {
    const phi = -Math.PI / 2 + (Math.PI * k) / steps
    const [nr, nz] = [Math.cos(phi) / DRIP_R, Math.sin(phi) / half]
    const len = Math.hypot(nr, nz)
    return {
      r: DRIP_R * Math.cos(phi),
      z: centre + half * Math.sin(phi),
      nr: nr / len,
      nz: nz / len,
    }
  })
  curve[0]!.r = 0
  curve[steps]!.r = 0
  const out: Vec3 = [Math.cos(angle), Math.sin(angle), 0]
  const side: Vec3 = [-Math.sin(angle), Math.cos(angle), 0]
  const seat = neckR + FIT_MM + DRIP_FLAT * DRIP_R + 0.05
  revolve(b, curve, 12, (r, z, nr, nz, psi) => {
    const c = Math.cos(psi)
    const s = Math.sin(psi)
    const x = seat + r * DRIP_FLAT * c
    const y = r * s
    const nx = (nr * c) / DRIP_FLAT
    const ny = nr * s
    return [
      [x * out[0] + y * side[0], x * out[1] + y * side[1], z],
      unit([nx * out[0] + ny * side[0], nx * out[1] + ny * side[1], nz]),
    ]
  })
}

function stopperPart(profile: BottleProfile): MeshPart {
  const b = lathePart(profile.stopper, STOPPER_SEGMENTS)
  const capBottom = profile.waxCapBottomZ
  if (capBottom !== null) {
    const top = capBottom + 1
    const room = top - profile.shoulderZ - 1
    for (const [angle, length] of DRIPS) {
      drip(b, FRONT_ANGLE + angle, top, Math.min(length, room), profile.neckR)
    }
  }
  return b.part()
}

/** The glass's outer surface by arc length up the body: radius, height and unit normal. */
interface Surface {
  at(s: number): ProfilePoint
  sOf(z: number): number
  length: number
}

function bodySurface(profile: BottleProfile, top = profile.shoulderZ): Surface {
  const step = 0.1
  const pts: ProfilePoint[] = []
  const ss: number[] = []
  for (let z = 1; z <= top; z += step) {
    const slope = (profile.outerR(z + 0.3) - profile.outerR(z - 0.3)) / 0.6
    const len = Math.hypot(1, slope)
    const p = { r: profile.outerR(z), z, nr: 1 / len, nz: -slope / len }
    const last = pts.at(-1)
    ss.push(last ? ss.at(-1)! + Math.hypot(p.r - last.r, p.z - last.z) : 0)
    pts.push(p)
  }
  const index = (s: number) => {
    let lo = 0
    let hi = ss.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (ss[mid]! <= s) lo = mid
      else hi = mid
    }
    return lo
  }
  return {
    length: ss.at(-1)!,
    at(s) {
      const i = Math.min(index(s), pts.length - 2)
      const a = pts[i]!
      const b = pts[i + 1]!
      const t = Math.max(0, Math.min(1, (s - ss[i]!) / (ss[i + 1]! - ss[i]!)))
      const nr = a.nr + (b.nr - a.nr) * t
      const nz = a.nz + (b.nz - a.nz) * t
      const len = Math.hypot(nr, nz)
      return { r: a.r + (b.r - a.r) * t, z: a.z + (b.z - a.z) * t, nr: nr / len, nz: nz / len }
    },
    sOf(z) {
      const i = Math.max(0, Math.min(pts.length - 1, Math.round((z - 1) / step)))
      return ss[i]!
    },
  }
}

type SheetPlace = (u: number, v: number, d: number) => [p: Vec3, n: Vec3]

/** A thin closed sheet: front and back over a grid of (a, c) in [-1, 1]^2, and four side strips. */
function sheet(
  b: Builder,
  place: SheetPlace,
  shape: (a: number, c: number) => [u: number, v: number],
  na: number,
  nc: number,
  back: number,
  front: number,
): void {
  const uvAt = (i: number, j: number) => shape(-1 + (2 * i) / na, -1 + (2 * j) / nc)
  for (const [d, sign] of [
    [front, 1],
    [back, -1],
  ] as const) {
    const grid: number[][] = []
    for (let i = 0; i <= na; i++) {
      grid.push([])
      for (let j = 0; j <= nc; j++) {
        const [u, v] = uvAt(i, j)
        const [p, n] = place(u, v, d)
        grid[i]!.push(b.vertex(p, [n[0] * sign, n[1] * sign, n[2] * sign], u, v))
      }
    }
    for (let i = 0; i < na; i++)
      for (let j = 0; j < nc; j++) {
        b.tri(grid[i]![j]!, grid[i + 1]![j]!, grid[i + 1]![j + 1]!)
        b.tri(grid[i]![j]!, grid[i + 1]![j + 1]!, grid[i]![j + 1]!)
      }
  }
  const mid = (back + front) / 2
  const edges: [number, number, number, number][][] = [
    Array.from({ length: na + 1 }, (_, i) => [i, 0, i, 1]),
    Array.from({ length: na + 1 }, (_, i) => [i, nc, i, nc - 1]),
    Array.from({ length: nc + 1 }, (_, j) => [0, j, 1, j]),
    Array.from({ length: nc + 1 }, (_, j) => [na, j, na - 1, j]),
  ]
  for (const edge of edges) {
    const strip = edge.map(([i, j, ii, jj]) => {
      const [u, v] = uvAt(i, j)
      const [pm, n] = place(u, v, mid)
      const [qm] = place(...uvAt(ii, jj), mid)
      const away: Vec3 = [pm[0] - qm[0], pm[1] - qm[1], pm[2] - qm[2]]
      const k = away[0] * n[0] + away[1] * n[1] + away[2] * n[2]
      const out = unit([away[0] - k * n[0], away[1] - k * n[1], away[2] - k * n[2]])
      return [b.vertex(place(u, v, front)[0], out, u, v), b.vertex(place(u, v, back)[0], out, u, v)]
    })
    for (let k = 1; k < strip.length; k++) {
      const [f0, b0] = strip[k - 1]!
      const [f1, b1] = strip[k]!
      b.tri(f0!, f1!, b0!)
      b.tri(f1!, b1!, b0!)
    }
  }
}

/** Where on the body a label goes: the middle of its widest band. */
function labelCentre(profile: BottleProfile): number {
  const zs: number[] = []
  for (let z = 3; z <= profile.shoulderZ * 0.95; z += 0.25) zs.push(z)
  const widest = Math.max(...zs.map((z) => profile.outerR(z)))
  const band = zs.filter((z) => profile.outerR(z) >= 0.95 * widest)
  return (band[0]! + band.at(-1)!) / 2
}

/** How far up or down the surface from s0 the body stays within a quarter of its radius there. */
function reach(surface: Surface, s0: number): number {
  const r0 = surface.at(s0).r
  let best = Infinity
  for (const dir of [-1, 1]) {
    let s = s0
    while (s > 2 && s < surface.length - 2 && surface.at(s).r >= 0.75 * r0) s += dir * 0.25
    best = Math.min(best, Math.abs(s - s0))
  }
  return best
}

function paperPlace(
  surface: Surface,
  s0: number,
  radiusFor: (p: ProfilePoint) => number,
): SheetPlace {
  return (u, v, d) => {
    const pt = surface.at(s0 + v)
    const angle = FRONT_ANGLE + u / radiusFor(pt)
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    const n: Vec3 = [pt.nr * c, pt.nr * s, pt.nz]
    return [[pt.r * c + d * n[0], pt.r * s + d * n[1], pt.z + d * n[2]], n]
  }
}

const gridCount = (mm: number) => Math.max(4, Math.ceil(mm / PAPER_GRID_MM))

function roundLabel(b: Builder, profile: BottleProfile): void {
  const surface = bodySurface(profile)
  const s0 = surface.sOf(labelCentre(profile))
  const r0 = surface.at(s0).r
  const across = Math.min(
    ROUND_SHARE * profile.shoulderZ,
    r0 * ROUND_MAX_TURN,
    2 * reach(surface, s0),
  )
  const rho = across / 2
  sheet(
    b,
    paperPlace(surface, s0, (p) => p.r),
    (a, c) => [rho * a * Math.sqrt(1 - (c * c) / 2), rho * c * Math.sqrt(1 - (a * a) / 2)],
    gridCount(across),
    gridCount(across),
    PAPER_BACK_MM,
    PAPER_FRONT_MM,
  )
}

function bannerLabel(b: Builder, profile: BottleProfile): void {
  const surface = bodySurface(profile)
  const s0 = surface.sOf(labelCentre(profile))
  const r0 = surface.at(s0).r
  const half = (r0 * BANNER_TURN) / 2
  sheet(
    b,
    paperPlace(surface, s0, () => r0),
    (a, c) => [a * (half - BANNER_NOTCH * (1 - Math.abs(c))), c * BANNER_HALF_HEIGHT],
    gridCount(2 * half),
    gridCount(2 * BANNER_HALF_HEIGHT),
    PAPER_BACK_MM,
    PAPER_FRONT_MM,
  )
}

function tagLabel(b: Builder, profile: BottleProfile): void {
  const { neckR, shoulderZ } = profile
  const loopZ = shoulderZ + Math.min(3, (profile.neckTopZ - shoulderZ) / 2)
  const holeZ = shoulderZ - 6
  const right: Vec3 = [1, 0, 0]
  const onFace = STRING_R + CARD_HALF_THICK + 0.05
  // The card hangs in a U of string that runs down across its face through the hole.
  const threads = (hole: Vec3, normal: Vec3): Vec3[] =>
    [
      [-4, 0],
      [0, -1.5],
      [4, 0],
    ].map(([x, dz]) => [
      hole[0] + x!,
      hole[1] + normal[1] * onFace,
      hole[2] + dz! + normal[2] * onFace,
    ])
  const stringClears = (p: Vec3) => {
    let r = 0
    for (let dz = -1; dz <= 1; dz += 0.25) r = Math.max(r, profile.outerR(p[2] + dz))
    return Math.hypot(p[0], p[1]) >= r + STRING_R + 0.4
  }
  let gap = 2.5
  let card: { hole: Vec3; down: Vec3; normal: Vec3 } | null = null
  while (!card) {
    const hole: Vec3 = [0, -(profile.outerR(holeZ) + gap), holeZ]
    for (let deg = 0; deg <= 85 && !card; deg++) {
      const a = (deg * Math.PI) / 180
      const down: Vec3 = [0, -Math.sin(a), -Math.cos(a)]
      const normal: Vec3 = [0, -Math.cos(a), Math.sin(a)]
      const clear =
        cardClears(profile, hole, down, normal) && threads(hole, normal).every(stringClears)
      if (clear) card = { hole, down, normal }
    }
    gap += 0.5
  }
  const { hole, down, normal } = card
  const place: SheetPlace = (u, v, d) => [
    [
      hole[0] + u * right[0] + (CARD_HOLE_V - v) * down[0] + d * normal[0],
      hole[1] + u * right[1] + (CARD_HOLE_V - v) * down[1] + d * normal[1],
      hole[2] + u * right[2] + (CARD_HOLE_V - v) * down[2] + d * normal[2],
    ],
    normal,
  ]
  sheet(
    b,
    place,
    (a, c) => [a * CARD_HALF_WIDTH, c * CARD_HALF_HEIGHT],
    gridCount(2 * CARD_HALF_WIDTH),
    gridCount(2 * CARD_HALF_HEIGHT),
    -CARD_HALF_THICK,
    CARD_HALF_THICK,
  )
  const surface = bodySurface(profile, loopZ)
  const hug = STRING_R + 0.8
  const lay = (s: number, angle: number): Vec3 => {
    const p = surface.at(s)
    const r = p.r + hug * p.nr
    return [r * Math.cos(angle), r * Math.sin(angle), p.z + hug * p.nz]
  }
  const sLoop = surface.sOf(loopZ)
  const sFree = surface.sOf(holeZ) + 5
  const open = 0.9
  const off = 4 / profile.outerR(holeZ)
  const loop: Vec3[] = []
  for (
    let a = FRONT_ANGLE + open;
    a <= FRONT_ANGLE + 2 * Math.PI - open;
    a += STRING_STEP / neckR
  ) {
    loop.push(lay(sLoop, a))
  }
  const steps = Math.max(2, Math.ceil((sLoop - sFree) / STRING_STEP))
  const descent = (from: number, to: number) =>
    Array.from({ length: steps }, (_, k) => {
      const f = (k + 1) / steps
      return lay(sLoop + (sFree - sLoop) * f, from + (to - from) * f)
    })
  const [left, bottom, rightEnd] = threads(hole, normal) as [Vec3, Vec3, Vec3]
  const path = [
    ...loop,
    ...descent(FRONT_ANGLE + 2 * Math.PI - open, FRONT_ANGLE + 2 * Math.PI - off),
    ...segment(lay(sFree, FRONT_ANGLE - off), left),
    ...segment(left, bottom),
    ...segment(bottom, rightEnd),
    ...segment(rightEnd, lay(sFree, FRONT_ANGLE + off)),
    ...descent(FRONT_ANGLE + open, FRONT_ANGLE + off)
      .reverse()
      .slice(1),
  ]
  tube(b, spaced(chaikin(chaikin(chaikin(path)))))
}

function cardClears(profile: BottleProfile, hole: Vec3, down: Vec3, normal: Vec3): boolean {
  for (let u = -CARD_HALF_WIDTH; u <= CARD_HALF_WIDTH; u += 1)
    for (let w = CARD_HOLE_V - CARD_HALF_HEIGHT; w <= CARD_HOLE_V + CARD_HALF_HEIGHT; w += 0.5) {
      const x = hole[0] + u + w * down[0] - CARD_HALF_THICK * normal[0]
      const y = hole[1] + w * down[1] - CARD_HALF_THICK * normal[1]
      const z = hole[2] + w * down[2] - CARD_HALF_THICK * normal[2]
      if (z < 0 || z > profile.lipZ) continue
      if (Math.hypot(x, y) < profile.outerR(z) + 0.2) return false
    }
  return true
}

/** Points along a segment, its start excluded. */
function segment(a: Vec3, b: Vec3): Vec3[] {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / STRING_STEP))
  return Array.from({ length: n }, (_, k) => {
    const t = (k + 1) / n
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  })
}

/** A closed path with points closer than half a step to the last one kept dropped. */
function spaced(path: Vec3[]): Vec3[] {
  const out = [path[0]!]
  for (const p of path.slice(1)) {
    const q = out.at(-1)!
    if (Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) >= 0.4) out.push(p)
  }
  return out
}

/** One round of corner cutting on a closed path. */
function chaikin(path: Vec3[]): Vec3[] {
  return path.flatMap((p, i) => {
    const q = path[(i + 1) % path.length]!
    const mix = (t: number): Vec3 => [
      p[0] + (q[0] - p[0]) * t,
      p[1] + (q[1] - p[1]) * t,
      p[2] + (q[2] - p[2]) * t,
    ]
    return [mix(0.25), mix(0.75)]
  })
}

/** A closed tube along a closed path, framed by parallel transport, the closing twist spread along it. */
function tube(b: Builder, path: Vec3[]): void {
  const n = path.length
  const dot = (a: Vec3, c: Vec3) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2]
  const tangents = path.map((_, k) => {
    const a = path[(k - 1 + n) % n]!
    const c = path[(k + 1) % n]!
    return unit([c[0] - a[0], c[1] - a[1], c[2] - a[2]])
  })
  const transport = (v: Vec3, t: Vec3): Vec3 => {
    const k = dot(v, t)
    return unit([v[0] - k * t[0], v[1] - k * t[1], v[2] - k * t[2]])
  }
  const t0 = tangents[0]!
  const normals: Vec3[] = [
    unit(Math.abs(t0[2]) < 0.9 ? cross(t0, [0, 0, 1]) : cross(t0, [1, 0, 0])),
  ]
  for (let k = 1; k < n; k++) normals.push(transport(normals[k - 1]!, tangents[k]!))
  const closing = transport(normals[n - 1]!, t0)
  const twist = Math.atan2(dot(cross(normals[0]!, closing), t0), dot(normals[0]!, closing))
  const rings = path.map((p, k) => {
    const normal = normals[k]!
    const bi = cross(tangents[k]!, normal)
    return Array.from({ length: STRING_SIDES }, (_, j) => {
      const a = (j / STRING_SIDES) * 2 * Math.PI - (twist * k) / n
      const dir: Vec3 = [
        Math.cos(a) * normal[0] + Math.sin(a) * bi[0],
        Math.cos(a) * normal[1] + Math.sin(a) * bi[1],
        Math.cos(a) * normal[2] + Math.sin(a) * bi[2],
      ]
      const at: Vec3 = [
        p[0] + STRING_R * dir[0],
        p[1] + STRING_R * dir[1],
        p[2] + STRING_R * dir[2],
      ]
      return b.vertex(at, dir, 0, 0)
    })
  })
  for (let k = 0; k < n; k++) {
    const lo = rings[k]!
    const hi = rings[(k + 1) % n]!
    for (let j = 0; j < STRING_SIDES; j++) {
      const j1 = (j + 1) % STRING_SIDES
      b.wound(lo[j]!, lo[j1]!, hi[j]!)
      b.wound(lo[j1]!, hi[j1]!, hi[j]!)
    }
  }
}

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

function labelPart(spec: PotionSpec, profile: BottleProfile): MeshPart | null {
  if (spec.label === 'none') return null
  const b = new Builder()
  if (spec.label === 'round') roundLabel(b, profile)
  else if (spec.label === 'banner') bannerLabel(b, profile)
  else tagLabel(b, profile)
  return b.part()
}

export function buildPotionMesh(spec: PotionSpec): PotionMesh {
  const profile = bottleProfile(spec)
  return {
    glass: lathePart([profile.glass], SEGMENTS).part(),
    liquid: lathePart([profile.liquid], SEGMENTS).part(),
    stopper: stopperPart(profile),
    label: labelPart(spec, profile),
  }
}
