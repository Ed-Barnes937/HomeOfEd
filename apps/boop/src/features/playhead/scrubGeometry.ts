/**
 * Where on a scrub track a pointer is (boop-playhead ticket 05, spec §4).
 *
 * Both strips are drawn as a row of equal segments — 16 position cells on the
 * song strip, 16 step ticks on the clip rail — and snapping is "the segment the
 * finger is *inside*", never the nearest boundary. So rather than re-deriving
 * each track's column maths in a second place (and drifting from it the first
 * time the tablet band compresses a cell), the gesture hit-tests the segments
 * the browser actually laid out. That keeps this module pure: it takes
 * rectangles and a coordinate, and knows nothing about the DOM.
 */

/** One drawn segment of a track, in track-relative pixels. */
export interface ScrubSegment {
  readonly left: number
  readonly width: number
}

/**
 * The segment `x` is over: the one it is inside, the nearer of the two around
 * it when it lands in a gap, and either end when it is off the track. `null`
 * only on an empty track.
 */
export function segmentAt(segments: readonly ScrubSegment[], x: number): number | null {
  if (segments.length === 0) return null
  let nearest = 0
  let nearestDistance = Infinity
  for (const [index, segment] of segments.entries()) {
    if (x >= segment.left && x < segment.left + segment.width) return index
    const distance = Math.min(Math.abs(x - segment.left), Math.abs(x - (segment.left + segment.width)))
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearest = index
    }
  }
  return nearest
}

/**
 * How far across `segment` the pointer sits — 0 at its left edge, and always
 * short of 1, so `floor(fraction × n)` never falls off the end of the n
 * sub-divisions a caller cuts the segment into. Clamps, so a pointer in the gap
 * beside it or well off the track still answers.
 */
export function fractionInSegment(segment: ScrubSegment, x: number): number {
  if (segment.width <= 0) return 0
  const offset = Math.max(0, x - segment.left)
  return Math.min(1 - Number.EPSILON, offset / segment.width)
}
