// A potion's lathe profiles: the glass, the liquid and the stopper as closed curves in
// (radius, height), with exact normals, the cavity's volume and the upright levels.
// Millimetres, the axis is z, the foot at z = 0. Three-free and safe for the main chunk.

import { sample } from '../sword/curve.ts'
import { BOTTLES } from './bottles.ts'
import type { PotionSpec } from './compile.ts'
import { MAX_POURS } from './potionSchema.ts'

export const WALL_MM = 2.5
/** The glass under the liquid, foot to cavity floor. */
export const BASE_MM = 5
/** How far every stopper reaches down the bore. */
export const PLUG_MM = 18
/** The liquid's skin inside the glass. */
export const LIQUID_GAP_MM = 0.3

const FOOT_ROUND_MM = 2
const REST_RING_MM = 2
const PUSH_UP_MM = 0.8
const LIP_FILLET_MM = 0.8
/** Dense sampling for volumes and radii; the meshed curves keep a point per turn or length. */
const STEP_MM = 0.2
const KEEP_TURN = (5 * Math.PI) / 180
const OUTLINE_TURN = (2 * Math.PI) / 180
const KEEP_LENGTH_MM = 3

const CORK_ABOVE_MM = 12
const WAX_CORK_ABOVE_MM = 6
const WAX_MM = 1.1
/** Clearance between a stopper and the glass it rests on. */
const FIT_MM = 0.05

/** A point on a profile with its unit normal, pointing out of the solid the curve bounds. */
export interface ProfilePoint {
  r: number
  z: number
  nr: number
  nz: number
}

export interface StopperSeat {
  /** The top of the lip, where every stopper meets the glass. */
  z: number
  /** The bore's radius. */
  r: number
  depthMm: number
}

export interface BottleProfile {
  /** Where the body ends and the neck begins. */
  shoulderZ: number
  /** The liquid's top at four pours. */
  fullZ: number
  lipZ: number
  /** The top of the cavity: the bottom of the stopper's plug. */
  cavityTopZ: number
  /** Foot to stopper top, room for the tallest stopper. */
  heightMm: number
  widthMm: number
  stopperSeat: StopperSeat
  /** Outer half width at height z, foot to lip. */
  outerR(z: number): number
  /** The cavity's radius at height z, floor to lip. */
  innerR(z: number): number
  /** The cavity's volume from its floor up to zTop, mm^3. */
  cavityVolume(zTop: number): number
  /** The height the cavity fills to with this volume. */
  levelFor(volume: number): number
  /** The glass's outer silhouette, from the foot's edge over the lip to the bore. */
  outer: ProfilePoint[]
  /** Closed generating curves, axis to axis, each traversed with its solid on the left. */
  glass: ProfilePoint[]
  liquid: ProfilePoint[]
  /** The stopper's lathe pieces. */
  stopper: ProfilePoint[][]
}

type Profiled = Pick<PotionSpec, 'shape' | 'bodyHeightMm' | 'neckMm' | 'heightMm' | 'stopper'>

type Point2 = [r: number, z: number]

/** Samples a parametric curve with normals on the right of travel, out of a solid on the left. */
function trace(f: (t: number) => Point2, lengthMm: number): ProfilePoint[] {
  const n = Math.max(2, Math.ceil(lengthMm / STEP_MM))
  const e = 1e-6
  const out: ProfilePoint[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const [r, z] = f(t)
    const [r0, z0] = f(Math.max(0, t - e))
    const [r1, z1] = f(Math.min(1, t + e))
    const len = Math.hypot(r1 - r0, z1 - z0)
    out.push({ r: Math.abs(r) < 1e-9 ? 0 : r, z, nr: (z1 - z0) / len, nz: -(r1 - r0) / len })
  }
  return out
}

const line = (a: Point2, b: Point2) =>
  trace(
    (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    Math.hypot(b[0] - a[0], b[1] - a[1]),
  )

/** An arc about a centre from angle a0 to a1 (radians, anticlockwise when a1 > a0). */
const arc = (c: Point2, radius: number, a0: number, a1: number) =>
  trace(
    (t) => {
      const a = a0 + (a1 - a0) * t
      return [c[0] + radius * Math.cos(a), c[1] + radius * Math.sin(a)]
    },
    radius * Math.abs(a1 - a0),
  )

/** Keeps a point wherever the curve has turned or run far enough since the last one kept. */
function decimate(piece: ProfilePoint[], keepTurn = KEEP_TURN): ProfilePoint[] {
  const out = [piece[0]!]
  let run = 0
  for (let i = 1; i < piece.length - 1; i++) {
    const p = piece[i]!
    const last = out.at(-1)!
    run += Math.hypot(p.r - piece[i - 1]!.r, p.z - piece[i - 1]!.z)
    const turn = Math.acos(Math.min(1, p.nr * last.nr + p.nz * last.nz))
    if (turn >= keepTurn || run >= KEEP_LENGTH_MM) {
      out.push(p)
      run = 0
    }
  }
  out.push(piece.at(-1)!)
  return out
}

/** Pieces joined end to end; a shared end stays doubled, so a corner keeps both normals. */
const join = (pieces: ProfilePoint[][]) => pieces.flatMap(decimate)

/** The curve offset into its solid by d, loops cut out and the result cut at zFrom..zTo. */
function inset(curve: ProfilePoint[], d: number, zFrom: number, zTo: number): ProfilePoint[] {
  const moved: ProfilePoint[] = []
  for (let i = 0; i < curve.length; i++) {
    const p = curve[i]!
    const q = { r: p.r - d * p.nr, z: p.z - d * p.nz, nr: p.nr, nz: p.nz }
    const last = moved.at(-1)
    if (last && i > 0) {
      const prev = curve[i - 1]!
      const along = (q.r - last.r) * (p.r - prev.r) + (q.z - last.z) * (p.z - prev.z)
      if (along <= 0) continue
    }
    moved.push(q)
  }
  return cutZ(moved, zFrom, zTo)
}

/** The part of a curve rising in z between zFrom and zTo, ends interpolated onto the cuts. */
function cutZ(curve: ProfilePoint[], zFrom: number, zTo: number): ProfilePoint[] {
  const lerp = (a: ProfilePoint, b: ProfilePoint, z: number): ProfilePoint => {
    const t = (z - a.z) / (b.z - a.z)
    const nr = a.nr + (b.nr - a.nr) * t
    const nz = a.nz + (b.nz - a.nz) * t
    const len = Math.hypot(nr, nz)
    return { r: a.r + (b.r - a.r) * t, z, nr: nr / len, nz: nz / len }
  }
  const out: ProfilePoint[] = []
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1]!
    const b = curve[i]!
    if (b.z <= zFrom || a.z >= zTo) continue
    if (out.length === 0) out.push(a.z < zFrom ? lerp(a, b, zFrom) : a)
    if (b.z >= zTo) {
      out.push(lerp(a, b, zTo))
      return out
    }
    out.push(b)
  }
  throw new Error('profile: the curve does not reach the cut')
}

/** Radius at z on a curve rising in z. */
function radiusAt(curve: ProfilePoint[], z: number): number {
  if (z <= curve[0]!.z) return curve[0]!.r
  if (z >= curve.at(-1)!.z) return curve.at(-1)!.r
  let lo = 0
  let hi = curve.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (curve[mid]!.z <= z) lo = mid
    else hi = mid
  }
  const a = curve[lo]!
  const b = curve[hi]!
  return b.z === a.z ? Math.max(a.r, b.r) : a.r + ((b.r - a.r) * (z - a.z)) / (b.z - a.z)
}

const reversed = (curve: ProfilePoint[]) =>
  [...curve].reverse().map((p) => ({ r: p.r, z: p.z, nr: -p.nr, nz: -p.nz }))

/** A closed lathe from a radius function rising from z0 to z1, flat ends chamfered by c0, c1. */
function plug(r: (z: number) => number, z0: number, z1: number, c0: number, c1: number) {
  return join([
    line([0, z0], [r(z0) - c0, z0]),
    line([r(z0) - c0, z0], [r(z0 + c0), z0 + c0]),
    line([r(z0 + c0), z0 + c0], [r(z1 - c1), z1 - c1]),
    line([r(z1 - c1), z1 - c1], [r(z1 - c1) - c1, z1]),
    line([r(z1 - c1) - c1, z1], [0, z1]),
  ])
}

export function bottleProfile(spec: Profiled): BottleProfile {
  const row = BOTTLES[spec.shape]
  const bodyH = spec.bodyHeightMm
  const lipZ = bodyH + spec.neckMm
  const neckR = row.neckRadiusMm
  const lip = row.lipMm
  const boreR = neckR - WALL_MM
  const neckTopZ = lipZ - 2 * lip
  const curve: [number, number][] = [
    ...row.body.map(([f, r]): [number, number] => [f * bodyH, r]),
    [neckTopZ, neckR],
  ]
  const body = (z: number) => sample(curve, z)

  // The foot: a domed push-up, a ring to stand on, and a round into the body.
  const r0 = body(0)
  const slope = (body(0.5) - r0) / 0.5
  const footZ = FOOT_ROUND_MM / Math.hypot(1, slope)
  const footA: Point2 = [r0 - FOOT_ROUND_MM, 0]
  const footB: Point2 = [body(footZ), footZ]
  const domeR = footA[0] - REST_RING_MM
  const bottom = trace((t) => [domeR * t, (PUSH_UP_MM * (1 + Math.cos(Math.PI * t))) / 2], domeR)
  const ring = line([domeR, 0], footA)
  const footRound = trace((t) => {
    const u = 1 - t
    return [u * u * footA[0] + 2 * t * u * r0 + t * t * footB[0], t * t * footB[1]]
  }, FOOT_ROUND_MM * 1.6)
  const side = trace(
    (t) => [body(footZ + (neckTopZ - footZ) * t), footZ + (neckTopZ - footZ) * t],
    neckTopZ - footZ,
  )
  const bead = arc([neckR, lipZ - lip], lip, -Math.PI / 2, Math.PI / 2)
  const lipTop = line([neckR, lipZ], [boreR + LIP_FILLET_MM, lipZ])
  const lipFillet = arc(
    [boreR + LIP_FILLET_MM, lipZ - LIP_FILLET_MM],
    LIP_FILLET_MM,
    Math.PI / 2,
    Math.PI,
  )
  const bore = line([boreR, lipZ - LIP_FILLET_MM], [boreR, neckTopZ])

  const outerDense = [...footRound, ...side.slice(1), ...bead.slice(1)]
  const wall = inset(side, WALL_MM, BASE_MM, neckTopZ)
  const innerDense = [...wall, { r: boreR, z: lipZ - LIP_FILLET_MM, nr: 1, nz: 0 }]
  const floorR = wall[0]!.r
  const floor = line([floorR, BASE_MM], [0, BASE_MM])

  const glass = join([
    bottom,
    ring,
    footRound,
    side,
    bead,
    lipTop,
    lipFillet,
    bore,
    reversed(wall),
    floor,
  ])

  const cavityTopZ = lipZ - PLUG_MM
  const skin = WALL_MM + LIQUID_GAP_MM
  const liquidWall = inset(side, skin, BASE_MM + LIQUID_GAP_MM, cavityTopZ - LIQUID_GAP_MM)
  const liquidTop = liquidWall.at(-1)!
  const liquid = join([
    line([0, BASE_MM + LIQUID_GAP_MM], [liquidWall[0]!.r, BASE_MM + LIQUID_GAP_MM]),
    liquidWall,
    line([liquidTop.r, liquidTop.z], [0, liquidTop.z]),
  ])

  // Cumulative volume at each point of the cavity's wall, by frustums from the floor.
  const cumulative = [0]
  for (let i = 1; i < innerDense.length; i++) {
    const a = innerDense[i - 1]!
    const b = innerDense[i]!
    const h = b.z - a.z
    cumulative.push(cumulative[i - 1]! + (Math.PI * h * (a.r * a.r + a.r * b.r + b.r * b.r)) / 3)
  }
  const innerR = (z: number) => radiusAt(innerDense, z)
  const cavityVolume = (zTop: number): number => {
    if (zTop <= BASE_MM) return 0
    let i = 1
    while (i < innerDense.length - 1 && innerDense[i]!.z < zTop) i++
    const a = innerDense[i - 1]!
    const top = Math.min(zTop, innerDense[i]!.z)
    const r = innerR(top)
    return cumulative[i - 1]! + (Math.PI * (top - a.z) * (a.r * a.r + a.r * r + r * r)) / 3
  }
  const levelFor = (volume: number): number => {
    let lo = BASE_MM
    let hi = cavityTopZ
    for (let k = 0; k < 60; k++) {
      const mid = (lo + hi) / 2
      if (cavityVolume(mid) < volume) lo = mid
      else hi = mid
    }
    return (lo + hi) / 2
  }

  const seat = { z: lipZ, r: boreR, depthMm: PLUG_MM }
  const outerR = (z: number) => radiusAt(outerDense, z)
  return {
    shoulderZ: bodyH,
    fullZ: row.fullAt * bodyH,
    lipZ,
    cavityTopZ,
    heightMm: spec.heightMm,
    widthMm: 2 * Math.max(...outerDense.map((p) => p.r)),
    stopperSeat: seat,
    outerR,
    innerR,
    cavityVolume,
    levelFor,
    outer: [footRound, side, bead, lipTop].flatMap((piece) => decimate(piece, OUTLINE_TURN)),
    glass,
    liquid,
    stopper: stopperPieces(spec, seat, neckR, lip),
  }
}

function stopperPieces(
  spec: Profiled,
  seat: StopperSeat,
  neckR: number,
  lip: number,
): ProfilePoint[][] {
  const { z: lipZ, r: boreR } = seat
  const z0 = lipZ - seat.depthMm
  const taper = (bottomR: number) => {
    const k = (boreR - FIT_MM - bottomR) / seat.depthMm
    return (z: number) => boreR - FIT_MM + k * (z - lipZ)
  }
  const cork = taper(boreR - 1)
  if (spec.stopper === 'cork') return [plug(cork, z0, lipZ + CORK_ABOVE_MM, 0.6, 1.2)]
  if (spec.stopper === 'wax') {
    const top = lipZ + WAX_CORK_ABOVE_MM
    return [plug(cork, z0, top, 0.6, 1.2), waxCap(cork, top, lipZ, neckR, lip)]
  }
  return [glassStopper(taper(boreR - 0.7), z0, lipZ, neckR, lip, spec.heightMm)]
}

/** A dipped wax seal: it hugs the cork, the lip and the neck inside and is a round-edged cap outside. */
function waxCap(
  cork: (z: number) => number,
  top: number,
  lipZ: number,
  neckR: number,
  lip: number,
): ProfilePoint[] {
  const e = FIT_MM
  const t = WAX_MM
  const beadC: Point2 = [neckR, lipZ - lip]
  const capBottom = lipZ - 2 * lip - 2.5
  const innerEnd = -Math.acos(e / (lip + e))
  const outerEnd = -Math.acos((e + t) / (lip + e + t))
  const corkTopR = cork(top) + e
  const capR = neckR + lip + e + t
  const capTop = top + e + t
  const round = 2
  return join([
    line([0, top + e], [corkTopR, top + e]),
    line([corkTopR, top + e], [cork(lipZ + e) + e, lipZ + e]),
    line([cork(lipZ + e) + e, lipZ + e], [neckR, lipZ + e]),
    arc(beadC, lip + e, Math.PI / 2, innerEnd),
    line([neckR + e, beadC[1] + (lip + e) * Math.sin(innerEnd)], [neckR + e, capBottom]),
    arc([neckR + e + t / 2, capBottom], t / 2, Math.PI, 2 * Math.PI),
    line(
      [neckR + e + t, capBottom],
      [neckR + e + t, beadC[1] + (lip + e + t) * Math.sin(outerEnd)],
    ),
    arc(beadC, lip + e + t, outerEnd, 0),
    line([capR, beadC[1]], [capR, capTop - round]),
    arc([capR - round, capTop - round], round, 0, Math.PI / 2),
    line([capR - round, capTop], [0, capTop]),
  ])
}

/** A ground plug, a collar on the lip, a short stem and a teardrop knob to the top. */
function glassStopper(
  r: (z: number) => number,
  z0: number,
  lipZ: number,
  neckR: number,
  lip: number,
  topZ: number,
): ProfilePoint[] {
  const base = lipZ + FIT_MM
  const collarR = neckR + 0.5 * lip
  const collarTop = base + 1.6
  const round = 0.6
  const stemR = Math.max(2, 0.55 * r(lipZ))
  const knobZ = collarTop + 1.2
  const knobH = topZ - knobZ
  const knobR = 0.48 * knobH
  // A drop standing on its point's opposite end: widest a third of the way up.
  const p = Math.log(0.5) / Math.log(0.35)
  const knob = (t: number) => knobR * Math.sin(Math.PI * t ** p) ** 0.8
  let t0 = 0
  while (knob(t0) < stemR) t0 += 0.001
  return join([
    line([0, z0], [r(z0) - 0.5, z0]),
    line([r(z0) - 0.5, z0], [r(z0 + 0.5), z0 + 0.5]),
    line([r(z0 + 0.5), z0 + 0.5], [r(base), base]),
    line([r(base), base], [collarR - round, base]),
    arc([collarR - round, base + round], round, -Math.PI / 2, 0),
    line([collarR, base + round], [collarR, collarTop - round]),
    arc([collarR - round, collarTop - round], round, 0, Math.PI / 2),
    line([collarR - round, collarTop], [stemR, collarTop]),
    line([stemR, collarTop], [stemR, knobZ]),
    trace((t) => {
      const u = t0 + (1 - t0) * t
      return [knob(u), knobZ + (knobH * (u - t0)) / (1 - t0)]
    }, knobH * 2),
  ]).map((pt, i, all) => (i === all.length - 1 ? { r: 0, z: pt.z, nr: 0, nz: 1 } : pt))
}

/** The heights of each band's top when upright: each pour adds a quarter of the volume to fullZ. */
export function uprightLevels(spec: PotionSpec): number[] {
  return bandTops(bottleProfile(spec), spec.layers.length)
}

/** The tops of the first `count` bands of a bottle filled a quarter at a time to fullZ. */
export function bandTops(profile: BottleProfile, count: number): number[] {
  const full = profile.cavityVolume(profile.fullZ)
  return Array.from({ length: count }, (_, i) =>
    i === MAX_POURS - 1 ? profile.fullZ : profile.levelFor((full * (i + 1)) / MAX_POURS),
  )
}
