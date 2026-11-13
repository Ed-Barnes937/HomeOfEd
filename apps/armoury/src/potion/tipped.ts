// Where each band's top lies when the bottle tips: heights along world up, measured from
// the foot's centre, such that every band keeps its volume. Not for the main chunk.

import type { PotionSpec } from './compile.ts'
import { BASE_MM, bandTops, bottleProfile, type BottleProfile } from './profile.ts'

export interface LevelTable {
  stepDeg: number
  /** levels[i] holds each band's top, bottom first, at a tilt of i * stepDeg degrees. */
  levels: number[][]
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

function tiltedLevels(profile: BottleProfile, tops: number[], t: number): number[] {
  const n = Math.ceil((profile.cavityTopZ - BASE_MM) / SLICE_MM)
  const dz = (profile.cavityTopZ - BASE_MM) / n
  const zs = Float64Array.from({ length: n }, (_, i) => BASE_MM + (i + 0.5) * dz)
  const rs = zs.map((z) => profile.innerR(z))
  const s = Math.sin(t)
  const c = Math.cos(t)
  // Up is (sin t, 0, cos t) in the bottle's frame, so a level h cuts each slice at x = (h - z cos t) / sin t.
  const below = (h: number) => {
    let v = 0
    for (let i = 0; i < n; i++) v += segmentArea(rs[i]!, (h - zs[i]! * c) / s)
    return v * dz
  }
  let lowest = Infinity
  let highest = -Infinity
  for (let i = 0; i < n; i++) {
    lowest = Math.min(lowest, zs[i]! * c - rs[i]! * s)
    highest = Math.max(highest, zs[i]! * c + rs[i]! * s)
  }
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
  const levels = Array.from({ length: ROWS }, (_, i) =>
    i === 0 ? tops : tiltedLevels(profile, tops, (i * STEP_DEG * Math.PI) / 180),
  )
  return { stepDeg: STEP_DEG, levels }
}

/** The band tops at a tilt from upright, in radians, either way; interpolated between rows. */
export function levelsAt(table: LevelTable, tiltRadians: number): number[] {
  const deg = Math.min(90, (Math.abs(tiltRadians) * 180) / Math.PI)
  const i = Math.min(table.levels.length - 2, Math.floor(deg / table.stepDeg))
  const f = deg / table.stepDeg - i
  const a = table.levels[i]!
  const b = table.levels[i + 1]!
  return a.map((h, k) => h + (b[k]! - h) * f)
}
