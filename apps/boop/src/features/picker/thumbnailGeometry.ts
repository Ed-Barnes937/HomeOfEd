/**
 * How a `PatternThumbnail` lays its rows out when a clip holds more than the
 * default six (ADR 0041 — a clip owns its rows, 1..the kit roster).
 *
 * The rule: **the footprint is fixed, and the rows divide it.** The matrix
 * keeps the six-row height the design handoff gives it at every breakpoint
 * (§1's 8px pitch at laptop, 7px at tablet, 6px at phone), whatever the row
 * count, because the two places a thumbnail appears sit in layouts that must
 * not move — the picker's fixed-width cards and a "My boops" row.
 *
 * - **1..6 rows** keep the handoff's own pitch untouched and sit centred in
 *   the box. A one-row clip is one crisp row of dots, not a fat bar: shrinking
 *   the *count* must not stretch the dots.
 * - **7+ rows** divide the same box: a row's pitch is `100 / rowCount`% of it
 *   and the dot keeps the handoff's 0.55 share of that pitch. Dot *width* never
 *   changes (16 steps on a fixed-width card), so as rows grow the dots read as
 *   ever-finer horizontal dashes — the pattern survives as texture even once an
 *   individual dot is too small to count.
 * - The floor is a **device pixel on the shortest footprint**: once 0.55 of the
 *   pitch would fall under 1px on the phone's 33px box, the dot takes a bigger
 *   share of its pitch instead. It is spent on the gap between rows, never on
 *   the box, so the footprint still cannot grow.
 *
 * Percentages rather than pixels are what let one rule cover three
 * breakpoints: the footprint is a `px` height in `PatternThumbnail.module.scss`
 * and everything here is a share of it, so the media queries stay the only
 * place a breakpoint is named.
 */

/** Rows the handoff's own pitch covers before the footprint has to be divided. */
export const THUMBNAIL_BASELINE_ROWS = 6

/** The handoff's dot-to-pitch ratio (`round(8 x 0.55)` = 4px at laptop). */
export const THUMBNAIL_DOT_SHARE = 0.55

/**
 * The shortest footprint any breakpoint gives the matrix: the phone's six 3px
 * rows on 3px gaps (`PatternThumbnail.module.scss`). The dot floor is derived
 * from this one, so a dot that clears it clears every breakpoint.
 */
export const SMALLEST_THUMBNAIL_FOOTPRINT_PX = 33

/** Below this a dot stops being texture and starts being nothing. */
const MIN_DOT_HEIGHT_PX = 1

/**
 * Headroom for the browser's own subpixel snapping. A dot's height is a
 * percentage *of a percentage*, and layout truncates to a 1/64px unit at each
 * step, so asking for exactly one pixel measures 63/64 of one. Two units of
 * slack covers both truncations and makes the floor's promise something a test
 * can actually measure on the page (`manyRowMiniatures.iwft.tsx`).
 */
const SUBPIXEL_SLACK_PX = 2 / 64

/**
 * The two shares a dense thumbnail hands to CSS. Both are percentages, so they
 * ride whichever footprint the breakpoint chose.
 */
export interface DenseThumbnailRows {
  /** One row's share of the fixed footprint. `rowCount x this` is the whole box. */
  readonly rowPitchPercent: number
  /** The dot's share of its row's pitch — the rest is the gap around it. */
  readonly dotHeightPercent: number
}

/** Truncated, not rounded: `rowCount` pitches must never add past the box. */
const truncate3 = (value: number) => Math.floor(value * 1000) / 1000

/** Rounded up, so a floored dot lands on the pixel rather than a hair under it. */
const ceil3 = (value: number) => Math.ceil(value * 1000) / 1000

/**
 * The row geometry for a clip of `rowCount` rows, or `null` when the handoff's
 * own pitch already fits — six rows or fewer, which is every sample clip and
 * every thumbnail the app rendered before clips owned their rows. `null` means
 * "change nothing", which is why those thumbnails are pixel-identical.
 */
export function thumbnailRowGeometry(rowCount: number): DenseThumbnailRows | null {
  if (!Number.isFinite(rowCount) || rowCount <= THUMBNAIL_BASELINE_ROWS) return null

  const rowPitchPercent = truncate3(100 / rowCount)
  const pitchPx = (SMALLEST_THUMBNAIL_FOOTPRINT_PX * rowPitchPercent) / 100
  const flooredShare = ceil3(((MIN_DOT_HEIGHT_PX + SUBPIXEL_SLACK_PX) / pitchPx) * 100)

  return {
    rowPitchPercent,
    // Capped at the pitch: the dots may touch, they may not stack.
    dotHeightPercent: Math.min(100, Math.max(truncate3(THUMBNAIL_DOT_SHARE * 100), flooredShare)),
  }
}
