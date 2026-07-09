/**
 * Blob density and size formulas (spec §5.1). PURE TS.
 *
 * Density scales continuously with canvas area — no device breakpoints — and
 * per-blot size couples inversely to the count, so one system covers phone to
 * ultrawide.
 */

/** Blob count for a canvas of `cssW × cssH`: ~1 blob / 150k css-px², clamp [1,9]. */
export function blobCount(cssW: number, cssH: number): number {
  const raw = Math.round((cssW * cssH) / 150_000)
  return Math.min(9, Math.max(1, raw))
}

/**
 * Per-blot radius fraction (of the shorter viewBox side) for a given count:
 * count 1 → 0.26 (big, central-ish); count 9 → 0.10 (small, scattered field).
 */
export function blobRadiusFraction(count: number): number {
  return Math.min(0.26, Math.max(0.1, 0.26 - 0.02 * (count - 1)))
}
