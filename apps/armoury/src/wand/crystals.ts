// The crystal tip's shapes, as faceted solids in the crystal's own frame: x and y across,
// z along it from its base (sunk in the cup) at 0 to its point at `length`. Pure, so the
// spell's tip can be tested to sit on the point.

export type CrystalShape = 'hex' | 'double' | 'cluster' | 'shard' | 'teardrop'

type Vec3 = [number, number, number]

export interface CrystalSolid {
  positions: number[]
  indices: number[]
  /** The tip of the crystal, where the spell leaves. */
  point: Vec3
}

const TAU = Math.PI * 2

/** A ring of `sides` corners at height z; `scales` and `heights` make it irregular. */
function ring(
  sides: number,
  z: number,
  r: number,
  { turn = 0, scales, heights, shift = [0, 0] }: RingOptions = {},
): Vec3[] {
  return Array.from({ length: sides }, (_, i) => {
    const a = turn + (TAU * i) / sides
    const s = r * (scales?.[i] ?? 1)
    return [shift[0] + s * Math.cos(a), shift[1] + s * Math.sin(a), heights?.[i] ?? z]
  })
}

interface RingOptions {
  turn?: number
  scales?: number[]
  heights?: number[]
  shift?: [number, number]
}

/** A closed solid: a fan over the base, bands between rings, and a fan up to the apex. */
function solid(rings: Vec3[][], apex: Vec3): Omit<CrystalSolid, 'point'> {
  const sides = rings[0]!.length
  const positions: number[] = [0, 0, rings[0]![0]![2]]
  for (const r of rings) for (const v of r) positions.push(...v)
  positions.push(...apex)
  const top = positions.length / 3 - 1
  const at = (j: number, i: number) => 1 + j * sides + (i % sides)
  const indices: number[] = []
  for (let i = 0; i < sides; i++) {
    indices.push(0, at(0, i + 1), at(0, i))
    for (let j = 0; j + 1 < rings.length; j++)
      indices.push(
        at(j, i),
        at(j, i + 1),
        at(j + 1, i),
        at(j, i + 1),
        at(j + 1, i + 1),
        at(j + 1, i),
      )
    indices.push(at(rings.length - 1, i), at(rings.length - 1, i + 1), top)
  }
  return { positions, indices }
}

function merge(parts: Omit<CrystalSolid, 'point'>[]): Omit<CrystalSolid, 'point'> {
  const positions: number[] = []
  const indices: number[] = []
  for (const part of parts) {
    const offset = positions.length / 3
    positions.push(...part.positions)
    indices.push(...part.indices.map((i) => i + offset))
  }
  return { positions, indices }
}

/** A plain six-sided point: today's crystal. */
function hexPoint(r: number, length: number, base = 0.85, pointLength = 1.8 * r) {
  return solid(
    [
      ring(6, 0, base * r),
      ring(6, Math.min(1.5, 0.3 * length), r),
      ring(6, length - pointLength, r),
    ],
    [0, 0, length],
  )
}

/** Leans a small point out from the middle towards `towards`, standing at `from` off the axis. */
function leaning(
  part: Omit<CrystalSolid, 'point'>,
  towards: number,
  lean: number,
  from: Vec3,
): Omit<CrystalSolid, 'point'> {
  const [ux, uy] = [Math.cos(towards), Math.sin(towards)]
  const [c, s] = [Math.cos(lean), Math.sin(lean)]
  const positions: number[] = []
  for (let k = 0; k < part.positions.length; k += 3) {
    const [x, y, z] = part.positions.slice(k, k + 3) as Vec3
    const a = x * ux + y * uy
    const b = -x * uy + y * ux
    const [a2, z2] = [a * c + z * s, -a * s + z * c]
    positions.push(from[0] + a2 * ux - b * uy, from[1] + a2 * uy + b * ux, from[2] + z2)
  }
  return { positions, indices: part.indices }
}

const SHAPES: Record<CrystalShape, (r: number, length: number) => CrystalSolid> = {
  hex: (r, length) => ({ ...hexPoint(r, length), point: [0, 0, length] }),

  // Pointed at both ends: the lower point rises out of the cup to a waist, then the upper one.
  double: (r, length) => ({
    ...solid(
      [ring(6, 0, 0.22 * r), ring(6, 0.4 * length, 1.1 * r), ring(6, 0.64 * length, 1.1 * r)],
      [0, 0, length],
    ),
    point: [0, 0, length],
  }),

  // A slimmer main point with four smaller ones leaning out round it.
  cluster: (r, length) => ({
    ...merge([
      hexPoint(0.66 * r, length, 0.86, 1.4 * r),
      ...[
        { towards: 0.4, lean: 0.3, size: 0.5, height: 0.62 },
        { towards: 2.2, lean: 0.34, size: 0.44, height: 0.5 },
        { towards: 3.9, lean: 0.28, size: 0.46, height: 0.56 },
        { towards: 5.3, lean: 0.38, size: 0.38, height: 0.4 },
      ].map(({ towards, lean, size, height }) =>
        leaning(hexPoint(size * r, height * length, 0.7, 1.8 * size * r), towards, lean, [
          0.34 * r * Math.cos(towards),
          0.34 * r * Math.sin(towards),
          1.2,
        ]),
      ),
    ]),
    point: [0, 0, length],
  }),

  // Five uneven sides and a broken, slanting top whose point is off the middle.
  shard: (r, length) => {
    const scales = [1.12, 0.74, 1.15, 0.84, 1.0]
    const point: Vec3 = [0.3 * r, -0.12 * r, length]
    const top = [1.1, 2.9, 0.9, 2.3, 3.1].map((h) => length - h * r)
    // The waist stays under the lowest corner of the break, or the sides fold back.
    const waist = Math.min(0.3 * length, Math.min(...top) - 0.2 * r)
    return {
      ...solid(
        [
          ring(5, 0, 0.76 * r, { turn: 0.2, scales }),
          ring(5, Math.min(1.5, 0.5 * waist), 0.88 * r, { turn: 0.2, scales }),
          ring(5, waist, 0.96 * r, { turn: 0.32, scales, shift: [0.05 * r, 0] }),
          ring(5, 0, 0.92 * r, { turn: 0.4, scales, shift: [0.12 * r, -0.06 * r], heights: top }),
        ],
        point,
      ),
      point,
    }
  },

  // A briolette: a rounded bulb low down tapering to a long point, each row of facets
  // turned half a facet from the last.
  teardrop: (r, length) => ({
    ...solid(
      [
        [0, 0.8],
        [0.12, 1.05],
        [0.26, 1.2],
        [0.4, 1.12],
        [0.54, 0.88],
        [0.68, 0.58],
        [0.82, 0.3],
      ].map(([z, s], j) => ring(8, z! * length, s! * r, { turn: (j * Math.PI) / 8 })),
      [0, 0, length],
    ),
    point: [0, 0, length],
  }),
}

export function crystalSolid(shape: CrystalShape, radius: number, length: number): CrystalSolid {
  return (SHAPES[shape] ?? SHAPES.hex)(radius, length)
}
