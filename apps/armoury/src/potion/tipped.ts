// Where each band's top lies when the bottle tips: heights along world up, measured from
// the foot's centre, such that every band keeps its volume. Not for the main chunk.

import type { PotionSpec } from './compile.ts'
import { BASE_MM, bandTops, bottleProfile, type BottleProfile, LIQUID_GAP_MM } from './profile.ts'

/**
 * A level h is the plane dot(p, u) = h, with p in the bottle's millimetre frame from the foot's
 * centre and u world up expressed in that frame; it equals `aHeight` only when upright. Build
 * the table once per spec (it costs several milliseconds), never per frame.
 */
export interface LevelTable {
  stepDeg: number
  /** levels[i] holds each band's top, bottom first, at a tilt of i * stepDeg degrees. */
  levels: number[][]
  /** floors[i] is the liquid's lowest point along up at that tilt: its floor upright. */
  floors: number[]
}

const STEP_DEG = 5
const ROWS = 90 / STEP_DEG + 1
const SLICE_MM = 0.25
const ITERATIONS = 40

/** The area of the part of a disc of radius r with x at most c. */
function segmentArea(r: number, c: number): number {
  if (c <= -r) return 0
  if (c >= r) return Math.PI * r * r
  return r * r * Math.acos(-c / r) + c * Math.sqrt(r * r - c * c)
}

/** The cavity cut into thin slices along its axis: each slice's middle height and radius. */
interface Slices {
  zs: Float64Array
  rs: Float64Array
  dz: number
}

function slicesOf(profile: BottleProfile): Slices {
  const n = Math.ceil((profile.cavityTopZ - BASE_MM) / SLICE_MM)
  const dz = (profile.cavityTopZ - BASE_MM) / n
  const zs = Float64Array.from({ length: n }, (_, i) => BASE_MM + (i + 0.5) * dz)
  return { zs, rs: zs.map((z) => profile.innerR(z)), dz }
}

/** The cavity's lowest point along up at tilt t: on its floor's edge, or on a slice. */
function lowestAt(profile: BottleProfile, { zs, rs }: Slices, t: number): number {
  const s = Math.sin(t)
  const c = Math.cos(t)
  let lowest = BASE_MM * c - profile.innerR(BASE_MM) * s
  for (let i = 0; i < zs.length; i++) lowest = Math.min(lowest, zs[i]! * c - rs[i]! * s)
  return lowest
}

function tiltedLevels(profile: BottleProfile, slices: Slices, tops: number[], t: number): number[] {
  const { zs, rs, dz } = slices
  const n = zs.length
  const s = Math.sin(t)
  const c = Math.cos(t)
  // Up is (sin t, 0, cos t) in the bottle's frame; level h cuts a slice at x = (h - z c) / s.
  const below = (h: number) => {
    let v = 0
    for (let i = 0; i < n; i++) v += segmentArea(rs[i]!, (h - zs[i]! * c) / s)
    return v * dz
  }
  const lowest = lowestAt(profile, slices, t)
  let highest = -Infinity
  for (let i = 0; i < n; i++) highest = Math.max(highest, zs[i]! * c + rs[i]! * s)
  return tops.map((top) => {
    const volume = profile.cavityVolume(top)
    let lo = lowest
    let hi = highest
    for (let k = 0; k < ITERATIONS; k++) {
      const mid = (lo + hi) / 2
      if (below(mid) < volume) lo = mid
      else hi = mid
    }
    return (lo + hi) / 2
  })
}

export function levelTable(spec: PotionSpec): LevelTable {
  const profile = bottleProfile(spec)
  const tops = bandTops(profile, spec.layers.length)
  const slices = slicesOf(profile)
  const tilt = (i: number) => (i * STEP_DEG * Math.PI) / 180
  const levels = Array.from({ length: ROWS }, (_, i) =>
    i === 0 ? tops : tiltedLevels(profile, slices, tops, tilt(i)),
  )
  // The liquid's skin lies LIQUID_GAP_MM inside the cavity all round.
  const floors = Array.from(
    { length: ROWS },
    (_, i) => lowestAt(profile, slices, tilt(i)) + LIQUID_GAP_MM,
  )
  return { stepDeg: STEP_DEG, levels, floors }
}

/** The row below a tilt in radians, either way, and how far it is towards the next. */
function rowAt(table: LevelTable, tiltRadians: number): [row: number, f: number] {
  const deg = Math.min(90, (Math.abs(tiltRadians) * 180) / Math.PI)
  const i = Math.min(table.levels.length - 2, Math.floor(deg / table.stepDeg))
  return [i, deg / table.stepDeg - i]
}

/** The band tops at a tilt from upright, in radians, either way; interpolated between rows, into `out` if given. */
export function levelsAt(table: LevelTable, tiltRadians: number, out: number[] = []): number[] {
  const [i, f] = rowAt(table, tiltRadians)
  const a = table.levels[i]!
  const b = table.levels[i + 1]!
  out.length = a.length
  for (let k = 0; k < a.length; k++) out[k] = a[k]! + (b[k]! - a[k]!) * f
  return out
}

/** The liquid's lowest point along up at a tilt from upright, in radians, either way. */
export function floorAt(table: LevelTable, tiltRadians: number): number {
  const [i, f] = rowAt(table, tiltRadians)
  return table.floors[i]! + (table.floors[i + 1]! - table.floors[i]!) * f
}
