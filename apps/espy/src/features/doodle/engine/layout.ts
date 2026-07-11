/**
 * Blob density and size formulas (spec §5.1). PURE TS.
 *
 * Density scales continuously with canvas area — no device breakpoints — and
 * per-blot size couples inversely to the count, so one system covers phone to
 * ultrawide.
 */

/**
 * Small-canvas FLOOR (spec §5.1 addendum — see ADR 0016). Density scales with
 * absolute area, so a phone-sized canvas (~150–400k css-px²) otherwise falls to
 * a single large blot: sparse, and — because the fluid's distortion is a fixed
 * magnitude — proportionally too smooth to read as a "funky" mark. Flooring the
 * count gives phones a small varied field instead. Above the floor the 190k
 * density takes over unchanged, so tablet/desktop composition is untouched.
 * One knob, trivial to tune or revert.
 */
export const MIN_BLOBS = 3

/** Blob count for a canvas of `cssW × cssH`: ~1 blob / 190k css-px², floored at
 * `MIN_BLOBS` for small screens, clamped to 8. */
export function blobCount(cssW: number, cssH: number): number {
  const raw = Math.round((cssW * cssH) / 190_000)
  return Math.min(8, Math.max(MIN_BLOBS, raw))
}

/**
 * Per-blot radius fraction (of the shorter viewBox side) for a given count:
 * count 1 → 0.26 (big, central-ish); count 8 → 0.12 (small, scattered field).
 */
export function blobRadiusFraction(count: number): number {
  return Math.min(0.26, Math.max(0.1, 0.26 - 0.02 * (count - 1)))
}
