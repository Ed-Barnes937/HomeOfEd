// How big a potion is drawn in the box stage, and where it stands. Three-free
// and safe for the main chunk.

import { BOTTLES, type BottleParams, drawnHeightMm, type ShapeId } from './bottles.ts'

/** The tallest bottle at its longest neck, foot to stopper top. */
export const TALLEST_MM = Math.max(
  ...(Object.keys(BOTTLES) as ShapeId[]).map((shape) => drawnHeightMm({ shape, neck: 1 })),
)

/** The foot's height in the box stage, as a fraction of the stage from the top. */
export const BASE_LINE = 0.84

/** The fraction of the stage's fill a bottle is drawn at. */
export function drawnHeightFraction(p: BottleParams): number {
  return drawnHeightMm(p) / TALLEST_MM
}
