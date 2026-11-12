// How big a sword is drawn in the box stage: a compressed scale, so a dagger
// stays a good size and a greatsword still fits (decision O3).

/** Just under the shortest dagger, pommel end to tip. */
export const SHORTEST_SWORD_MM = 320
/** Just over the longest greatsword. */
export const LONGEST_SWORD_MM = 1840

const SMALLEST = 0.55
const COMPRESSION = 0.6

/** The fraction of the stage's fill a sword of this overall length is drawn at. */
export function drawnFraction(lengthMm: number): number {
  const t = Math.min(
    1,
    Math.max(0, (lengthMm - SHORTEST_SWORD_MM) / (LONGEST_SWORD_MM - SHORTEST_SWORD_MM)),
  )
  return SMALLEST + (1 - SMALLEST) * t ** COMPRESSION
}
