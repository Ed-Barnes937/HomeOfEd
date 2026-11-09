// Where set gems go on a wand, in straight (angle, z) space. Pure, so a later
// bend of the wand can carry these points along with the rest of its surface.

const TAU = Math.PI * 2

export interface SetGem {
  theta: number
  z: number
  /** The seat's radius, mm; the stone is a little smaller. */
  radius: number
}

export type GemPattern = 'ring' | 'line' | 'spiral'

/** A setting's lip, mm wide, round each seat. */
export const RIM_WIDTH = 0.6

/** The side of the wand that faces up in its box, where a row of gems shows best. */
export const SHOWN_SIDE = Math.PI * 0.6

export interface GemLayout {
  pattern: GemPattern
  count: number
  /** The seat radius asked for, mm. */
  size: number
  /** Where round the handle the ring sits, mm from the pommel. */
  belt: number
  /** The stretch of shaft a row or spiral of gems runs along. */
  shaft: [number, number]
  /** Stretches of the shaft the gems keep clear of, such as bands and bumps. */
  avoid: [number, number][]
  /** A twisting shaft carving for a spiral of gems to follow; `offset` puts them between its grooves. */
  spiral: { twist: number; from: number; offset: number } | null
  /** Turns per mm a spiral of gems winds by when there's no carving to follow, centred on the shown side. */
  twist: number
  radius: (z: number) => number
}

const SMALLEST_SEAT = 0.8

/** Clears room for a seat and its rim either side of a gem, plus a little wood. */
const clearance = (radius: number) => radius + RIM_WIDTH + 0.2

function allowedStretches(
  [from, to]: [number, number],
  avoid: [number, number][],
  margin: number,
): [number, number][] {
  let stretches: [number, number][] = [[from + margin, to - margin]]
  for (const [a, b] of avoid) {
    stretches = stretches.flatMap(([s, e]): [number, number][] => {
      const lo = a - margin
      const hi = b + margin
      if (hi <= s || lo >= e) return [[s, e]]
      return [
        [s, Math.min(e, lo)],
        [Math.max(s, hi), e],
      ].filter(([x, y]) => y! > x!) as [number, number][]
    })
  }
  return stretches
}

/** Evenly spaced points along the stretches, as if they were laid end to end. */
function spread(stretches: [number, number][], count: number): number[] {
  const total = stretches.reduce((sum, [s, e]) => sum + e - s, 0)
  return Array.from({ length: count }, (_, k) => {
    let at = ((k + 0.5) / count) * total
    for (const [s, e] of stretches) {
      if (at <= e - s) return s + at
      at -= e - s
    }
    return stretches[stretches.length - 1]![1]
  })
}

export function placeGems(layout: GemLayout): SetGem[] {
  const { pattern, count, size } = layout
  // A seat never covers more than this much of the wood's radius.
  const fits = (z: number, radius: number) => Math.min(radius, 0.4 * layout.radius(z))

  if (pattern === 'ring') {
    const z = layout.belt
    const pitch = (TAU * layout.radius(z)) / count
    const radius = fits(z, Math.min(size, pitch / 2 - RIM_WIDTH - 0.2))
    return Array.from({ length: count }, (_, k) => ({
      theta: SHOWN_SIDE + (TAU * k) / count,
      z,
      radius,
    }))
  }

  // Placed as if every seat were the smallest, so the count never depends on the size asked for.
  const stretches = allowedStretches(layout.shaft, layout.avoid, clearance(SMALLEST_SEAT))
  const room = stretches.reduce((sum, [s, e]) => sum + e - s, 0)
  const fitting = Math.min(count, Math.floor(room / (2 * clearance(SMALLEST_SEAT))))
  const largest = Math.min(size, room / fitting / 2 - RIM_WIDTH - 0.2)
  const [shaftFrom, shaftTo] = layout.shaft
  const keepOut: [number, number][] = [[-Infinity, shaftFrom], [shaftTo, Infinity], ...layout.avoid]
  return spread(stretches, fitting).map((z) => {
    const nearest = Math.min(...keepOut.map(([a, b]) => Math.max(a - z, z - b)))
    const radius = fits(z, Math.min(largest, nearest - RIM_WIDTH - 0.2))
    if (pattern === 'line') return { theta: SHOWN_SIDE, z, radius }
    const s = layout.spiral
    const theta = s
      ? s.offset + TAU * s.twist * (z - s.from)
      : SHOWN_SIDE + TAU * layout.twist * (z - (layout.shaft[0] + layout.shaft[1]) / 2)
    return { theta, z, radius }
  })
}
