// Where set gems go on a wand, in straight (angle, z) space. Pure, so a later
// bend of the wand can carry these points along with the rest of its surface.

const TAU = Math.PI * 2

export type GemCut = 'round' | 'square' | 'marquise'

export interface SetGem {
  theta: number
  z: number
  /** The seat's size, mm: a round seat's radius; the stone is a little smaller. */
  radius: number
  cut: GemCut
}

export type GemPattern = 'ring' | 'line' | 'spiral'

/** How far each cut's seat reaches along the wand and round it, per unit of its size. */
const REACH: Record<GemCut, { along: number; around: number }> = {
  round: { along: 1, around: 1 },
  square: { along: 0.86, around: 0.86 },
  marquise: { along: 1.45, around: 0.62 },
}

const SQUARE_CORNER = 0.2
/** A marquise's outline is where two circles overlap, side by side across the wand. */
const MARQUISE = (() => {
  const { along: a, around: w } = REACH.marquise
  return { circle: (w + (a * a) / w) / 2, apart: ((a * a) / w - w) / 2, tip: a }
})()

/** Signed distance, mm, from a seat's edge to a point `around` and `along` the wand from its middle; negative inside. */
export function seatDistance(gem: SetGem, around: number, along: number): number {
  const r = gem.radius
  const x = Math.abs(around)
  const y = Math.abs(along)
  if (gem.cut === 'square') {
    const inner = (REACH.square.along - SQUARE_CORNER) * r
    const [qx, qy] = [x - inner, y - inner]
    return (
      Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
      Math.min(Math.max(qx, qy), 0) -
      SQUARE_CORNER * r
    )
  }
  if (gem.cut === 'marquise') {
    const { circle, apart, tip } = MARQUISE
    return (y - tip * r) * apart > x * tip
      ? Math.hypot(x, y - tip * r)
      : Math.hypot(x + apart * r, y) - circle * r
  }
  return Math.hypot(x, y) - r
}

/** How far a seat reaches from its middle along the wand and round it, mm. */
export const seatReach = (gem: SetGem) => ({
  along: REACH[gem.cut].along * gem.radius,
  around: REACH[gem.cut].around * gem.radius,
})

/** The stone's outline round its girdle, [around, along] per unit of the seat's size. */
export function cutOutline(cut: GemCut): [number, number][] {
  if (cut === 'square') {
    const [h, c] = [REACH.square.along, REACH.square.along - SQUARE_CORNER]
    return [
      [h, c],
      [c, h],
      [-c, h],
      [-h, c],
      [-h, -c],
      [-c, -h],
      [c, -h],
      [h, -c],
    ]
  }
  if (cut === 'marquise') {
    const { circle, apart, tip } = MARQUISE
    const sweep = Math.atan2(tip, apart)
    const side = (sign: number) =>
      Array.from({ length: 5 }, (_, i): [number, number] => {
        const a = -sweep + ((i + 0.5) * 2 * sweep) / 5
        return [sign * (circle * Math.cos(a) - apart), sign * circle * Math.sin(a)]
      })
    return [...side(1), [0, tip], ...side(-1), [0, -tip]]
  }
  return Array.from({ length: 8 }, (_, i): [number, number] => [
    Math.cos((TAU * i) / 8),
    Math.sin((TAU * i) / 8),
  ])
}

/** A setting's lip, mm wide, round each seat. */
export const RIM_WIDTH = 0.6

/** The side of the wand that faces up in its box, where a row of gems shows best. */
export const SHOWN_SIDE = Math.PI * 0.6

export interface GemLayout {
  pattern: GemPattern
  cut: GemCut
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

/** The wood kept round each seat's rim, mm. */
const GAP = RIM_WIDTH + 0.2

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
  const { pattern, count, size, cut } = layout
  const { along, around } = REACH[cut]
  /** Clears room for a seat and its rim either side of a gem, along the wand, plus a little wood. */
  const clearance = (radius: number) => along * radius + GAP
  // A seat never covers more than this much of the wood's radius.
  const fits = (z: number, radius: number) => Math.min(radius, 0.4 * layout.radius(z))

  if (pattern === 'ring') {
    const z = layout.belt
    const pitch = (TAU * layout.radius(z)) / count
    const radius = fits(z, Math.min(size, (pitch / 2 - GAP) / around))
    return Array.from({ length: count }, (_, k) => ({
      theta: SHOWN_SIDE + (TAU * k) / count,
      z,
      radius,
      cut,
    }))
  }

  // Placed as if every seat were the smallest, so the count never depends on the size asked for.
  const stretches = allowedStretches(layout.shaft, layout.avoid, clearance(SMALLEST_SEAT))
  const room = stretches.reduce((sum, [s, e]) => sum + e - s, 0)
  const fitting = Math.min(count, Math.floor(room / (2 * clearance(SMALLEST_SEAT))))
  const largest = Math.min(size, (room / fitting / 2 - GAP) / along)
  const [shaftFrom, shaftTo] = layout.shaft
  const keepOut: [number, number][] = [[-Infinity, shaftFrom], [shaftTo, Infinity], ...layout.avoid]
  return spread(stretches, fitting).map((z) => {
    const nearest = Math.min(...keepOut.map(([a, b]) => Math.max(a - z, z - b)))
    const radius = fits(z, Math.min(largest, (nearest - GAP) / along))
    if (pattern === 'line') return { theta: SHOWN_SIDE, z, radius, cut }
    const s = layout.spiral
    const theta = s
      ? s.offset + TAU * s.twist * (z - s.from)
      : SHOWN_SIDE + TAU * layout.twist * (z - (layout.shaft[0] + layout.shaft[1]) / 2)
    return { theta, z, radius, cut }
  })
}
