// One data row per bottle shape: starting numbers, tuned by the form gate.

import type { ParamValue } from '../engine/schema.ts'

export type ShapeId = 'round' | 'teardrop' | 'tall' | 'shoulder' | 'gourd'

export interface BottleRow {
  label: string
  /** The shape's noun in the tag line. */
  noun: string
  /** The shape's noun in the potion's name. */
  nameNoun: string
  bodyHeightMm: number
  /** The `neck` slider maps into this range of neck lengths. */
  neckMm: [number, number]
  neckRadiusMm: number
  /** How far the lip stands proud of the neck. */
  lipMm: number
  /** Radius control points from the foot to the shoulder: [height fraction, radius mm]. */
  body: [number, number][]
}

export const BOTTLES: Record<ShapeId, BottleRow> = {
  round: {
    label: 'Round flask',
    noun: 'round flask',
    nameNoun: 'Brew',
    bodyHeightMm: 95,
    neckMm: [10, 45],
    neckRadiusMm: 9,
    lipMm: 2,
    body: [
      [0, 20],
      [0.15, 36],
      [0.4, 42],
      [0.7, 34],
      [1, 9],
    ],
  },
  teardrop: {
    label: 'Teardrop flask',
    noun: 'teardrop flask',
    nameNoun: 'Tonic',
    bodyHeightMm: 120,
    neckMm: [10, 45],
    neckRadiusMm: 8,
    lipMm: 2,
    body: [
      [0, 16],
      [0.12, 30],
      [0.3, 36],
      [0.6, 26],
      [0.85, 14],
      [1, 8],
    ],
  },
  tall: {
    label: 'Tall bottle',
    noun: 'tall bottle',
    nameNoun: 'Drops',
    bodyHeightMm: 150,
    neckMm: [10, 45],
    neckRadiusMm: 7,
    lipMm: 1.5,
    body: [
      [0, 22],
      [0.04, 24],
      [0.9, 24],
      [1, 16],
    ],
  },
  shoulder: {
    label: 'Square shoulders',
    noun: 'square-shouldered bottle',
    nameNoun: 'Mixture',
    bodyHeightMm: 120,
    neckMm: [10, 45],
    neckRadiusMm: 8,
    lipMm: 2,
    body: [
      [0, 28],
      [0.04, 30],
      [0.85, 30],
      [0.92, 26],
      [1, 12],
    ],
  },
  gourd: {
    label: 'Gourd bottle',
    noun: 'gourd bottle',
    nameNoun: 'Potion',
    bodyHeightMm: 130,
    neckMm: [10, 45],
    neckRadiusMm: 7,
    lipMm: 2,
    body: [
      [0, 18],
      [0.1, 30],
      [0.25, 36],
      [0.5, 18],
      [0.72, 24],
      [0.9, 16],
      [1, 7],
    ],
  },
}

/** Room above the neck for the stopper, in the drawn height. */
export const STOPPER_ALLOWANCE_MM = 18

export interface BottleParams {
  shape?: ParamValue
  neck?: ParamValue
}

const rowOf = (p: BottleParams): BottleRow => BOTTLES[p.shape as ShapeId] ?? BOTTLES.teardrop

export function neckLengthMm(p: BottleParams): number {
  const [min, max] = rowOf(p).neckMm
  return min + (p.neck as number) * (max - min)
}

/** Foot to stopper top. */
export function drawnHeightMm(p: BottleParams): number {
  return rowOf(p).bodyHeightMm + neckLengthMm(p) + STOPPER_ALLOWANCE_MM
}
