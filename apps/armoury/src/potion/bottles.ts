// One data row per bottle shape: starting numbers, tuned by the form gate.

import type { Params } from '../engine/schema.ts'

export type ShapeId = 'round' | 'teardrop' | 'tall' | 'shoulder' | 'gourd'

export interface BottleRow {
  label: string
  /** The shape's noun in the tag line. */
  noun: string
  /** The shape's noun in the potion's name. */
  nameNoun: string
  /** Foot to the top of the body, where the neck begins. */
  bodyHeightMm: number
  /** The `neck` slider maps into this range of neck lengths, top of the body to top of the lip. */
  neckMm: [number, number]
  /** The neck's outer radius. */
  neckRadiusMm: number
  /** How far the lip stands proud of the neck. */
  lipMm: number
  /**
   * Outer radius control points from the foot to the top of the body: [height fraction, radius
   * mm]. The body ends where the neck begins, so the last point is [1, neckRadiusMm].
   */
  body: [number, number][]
  /** How far up the body four pours reach, as a fraction of its height. */
  fullAt: number
}

export const BOTTLES: Record<ShapeId, BottleRow> = {
  round: {
    label: 'Round flask',
    noun: 'round flask',
    nameNoun: 'Brew',
    bodyHeightMm: 88,
    neckMm: [16, 40],
    neckRadiusMm: 9,
    lipMm: 2,
    body: [
      [0, 21.1],
      [0.06, 29.3],
      [0.14, 36.4],
      [0.24, 42.1],
      [0.36, 45.9],
      [0.477, 47],
      [0.6, 45.7],
      [0.72, 41.9],
      [0.82, 36],
      [0.9, 28.7],
      [0.95, 21.9],
      [1, 9],
    ],
    fullAt: 0.86,
  },
  teardrop: {
    label: 'Teardrop flask',
    noun: 'teardrop flask',
    nameNoun: 'Tonic',
    bodyHeightMm: 120,
    neckMm: [16, 42],
    neckRadiusMm: 8,
    lipMm: 2,
    body: [
      [0, 14.4],
      [0.03, 20.8],
      [0.07, 26.3],
      [0.12, 30.8],
      [0.19, 34.5],
      [0.275, 36],
      [0.36, 34.5],
      [0.45, 30.5],
      [0.58, 23],
      [0.74, 15],
      [0.88, 10.3],
      [1, 8],
    ],
    fullAt: 0.8,
  },
  tall: {
    label: 'Tall bottle',
    noun: 'tall bottle',
    nameNoun: 'Drops',
    bodyHeightMm: 150,
    neckMm: [18, 45],
    neckRadiusMm: 7.5,
    lipMm: 1.8,
    body: [
      [0, 20],
      [0.03, 21.5],
      [0.72, 21.5],
      [0.82, 19.5],
      [0.9, 14.5],
      [0.96, 9.5],
      [1, 7.5],
    ],
    fullAt: 0.8,
  },
  shoulder: {
    label: 'Square shoulders',
    noun: 'square-shouldered bottle',
    nameNoun: 'Mixture',
    bodyHeightMm: 115,
    neckMm: [16, 40],
    neckRadiusMm: 8,
    lipMm: 2,
    body: [
      [0, 27],
      [0.03, 29.5],
      [0.88, 30],
      [0.91, 29.5],
      [0.93, 27.5],
      [0.945, 21],
      [0.965, 12.5],
      [0.985, 9],
      [1, 8],
    ],
    fullAt: 0.84,
  },
  gourd: {
    label: 'Gourd bottle',
    noun: 'gourd bottle',
    nameNoun: 'Potion',
    bodyHeightMm: 135,
    neckMm: [16, 42],
    neckRadiusMm: 7,
    lipMm: 2,
    body: [
      [0, 18.3],
      [0.05, 26.6],
      [0.1, 31.5],
      [0.16, 34.8],
      [0.23, 36],
      [0.25, 35.9],
      [0.3, 34.7],
      [0.37, 30.6],
      [0.44, 22],
      [0.5, 15.5],
      [0.56, 17],
      [0.64, 21.5],
      [0.72, 24],
      [0.8, 23],
      [0.87, 19],
      [0.94, 12.5],
      [1, 7],
    ],
    fullAt: 0.82,
  },
}

/** Room above the lip for the tallest stopper, in the drawn height. */
export const STOPPER_ALLOWANCE_MM = 16

const rowOf = (p: Params): BottleRow => BOTTLES[p.shape as ShapeId]

export function neckLengthMm(p: Params): number {
  const [min, max] = rowOf(p).neckMm
  return min + (p.neck as number) * (max - min)
}

/** Foot to stopper top. */
export function drawnHeightMm(p: Params): number {
  return rowOf(p).bodyHeightMm + neckLengthMm(p) + STOPPER_ALLOWANCE_MM
}
