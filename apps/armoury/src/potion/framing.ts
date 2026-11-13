// How big a potion is drawn in the box stage, and where it stands. Three-free
// and safe for the main chunk.

import type { Params } from '../engine/schema.ts'
import { BOTTLES, drawnHeightMm, type ShapeId } from './bottles.ts'
import type { PotionSpec } from './compile.ts'

/** The tallest bottle at its longest neck, foot to stopper top. */
export const TALLEST_MM = Math.max(
  ...(Object.keys(BOTTLES) as ShapeId[]).map((shape) => drawnHeightMm({ shape, neck: 1 })),
)

/** The foot's height in the box stage, as a fraction of the stage from the top. */
export const BASE_LINE = 0.84

/** The fraction of the stage's fill a bottle is drawn at. */
export function drawnHeightFraction(p: Params): number {
  return drawnHeightMm(p) / TALLEST_MM
}

/** The same fraction for a compiled spec. */
export function heightFraction(spec: PotionSpec): number {
  return spec.heightMm / TALLEST_MM
}
