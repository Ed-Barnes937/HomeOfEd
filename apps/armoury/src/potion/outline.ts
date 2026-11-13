// The potion's silhouette for anything drawn in 2D: the glass, the stopper and the
// bands, in millimetres, x across and y up from the foot. Safe for the main chunk.

import type { PotionSpec } from './compile.ts'
import { BASE_MM, bandTops, bottleProfile, type ProfilePoint } from './profile.ts'

type Pt = [x: number, y: number]

export interface PotionSilhouette {
  /** Closed polygons: the right side rising, then the left side mirrored back down. */
  glass: Pt[]
  stopper: Pt[]
  /** Bottom first, one per pour, clipped to the cavity at the upright levels. */
  bands: { colour: string; points: Pt[] }[]
  widthMm: number
  heightMm: number
}

const BAND_STEP_MM = 1

/** A right-hand side rising in y, mirrored into a closed polygon. */
const mirrored = (right: Pt[]): Pt[] => [
  ...right,
  ...[...right].reverse().map(([x, y]): Pt => [-x, y]),
]

/** The widest radius of lathe curves at each height they reach; a flat step is two points. */
function envelope(pieces: ProfilePoint[][]): Pt[] {
  const segments = pieces
    .flatMap((c) => c.slice(1).map((b, i) => (c[i]!.z < b.z ? [c[i]!, b] : [b, c[i]!])))
    .filter(([a, b]) => a!.z < b!.z) as [ProfilePoint, ProfilePoint][]
  const ys = [...new Set(pieces.flat().map((p) => p.z))].sort((a, b) => a - b)
  const widest = (y: number, from: 'below' | 'above') => {
    let r = -1
    for (const [a, b] of segments) {
      const inside = from === 'below' ? a.z < y && y <= b.z : a.z <= y && y < b.z
      if (inside) r = Math.max(r, a.r + ((b.r - a.r) * (y - a.z)) / (b.z - a.z))
    }
    return r
  }
  return ys.flatMap((y) => {
    const below = widest(y, 'below')
    const above = widest(y, 'above')
    const out: Pt[] = []
    if (below >= 0) out.push([below, y])
    if (above >= 0 && above !== below) out.push([above, y])
    return out
  })
}

export function potionOutline(spec: PotionSpec): PotionSilhouette {
  const profile = bottleProfile(spec)
  const tops = bandTops(profile, spec.layers.length)
  const band = (lo: number, hi: number): Pt[] => {
    const n = Math.max(1, Math.ceil((hi - lo) / BAND_STEP_MM))
    return mirrored(
      Array.from({ length: n + 1 }, (_, i): Pt => {
        const y = i === n ? hi : lo + ((hi - lo) * i) / n
        return [profile.innerR(y), y]
      }),
    )
  }
  return {
    glass: mirrored(profile.outer.map((p): Pt => [p.r, p.z])),
    stopper: mirrored(envelope(profile.stopper)),
    bands: spec.layers.map((layer, i) => ({
      colour: layer.colour,
      points: band(i === 0 ? BASE_MM : tops[i - 1]!, tops[i]!),
    })),
    widthMm: profile.widthMm,
    heightMm: spec.heightMm,
  }
}
