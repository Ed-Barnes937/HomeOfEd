/**
 * Sim/renderer boundary maths (spec §5.5, §6) — pure functions, no DOM, so
 * they're plain vitest cases rather than a browser test.
 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Aspect-preserving scale-to-fit of a `gridWidth x gridHeight` buffer into a
 * `containerWidth x containerHeight` play area, centred (letterboxed).
 * Fractional scale factors are fine — the caller draws the world image
 * through `drawImage` with smoothing off, not a whole-pixel blit.
 */
export function computeLetterboxFit(
  containerWidth: number,
  containerHeight: number,
  gridWidth: number,
  gridHeight: number,
): Rect {
  if (containerWidth <= 0 || containerHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  const scale = Math.min(containerWidth / gridWidth, containerHeight / gridHeight)
  const width = gridWidth * scale
  const height = gridHeight * scale
  return { x: (containerWidth - width) / 2, y: (containerHeight - height) / 2, width, height }
}

/** Centre of a grid cell, in CSS px on the on-screen canvas. */
export function gridToCanvasPoint(
  fit: Rect,
  gridWidth: number,
  gridHeight: number,
  x: number,
  y: number,
): { x: number; y: number } {
  const scaleX = fit.width / gridWidth
  const scaleY = fit.height / gridHeight
  return { x: fit.x + (x + 0.5) * scaleX, y: fit.y + (y + 0.5) * scaleY }
}

/** The grid cell under a CSS-px point, or `null` outside the fit rect (the letterbox margin). */
export function canvasPointToGrid(
  fit: Rect,
  gridWidth: number,
  gridHeight: number,
  x: number,
  y: number,
): { x: number; y: number } | null {
  if (fit.width <= 0 || fit.height <= 0) return null
  if (x < fit.x || y < fit.y || x >= fit.x + fit.width || y >= fit.y + fit.height) return null
  const gx = Math.floor(((x - fit.x) / fit.width) * gridWidth)
  const gy = Math.floor(((y - fit.y) / fit.height) * gridHeight)
  if (gx < 0 || gy < 0 || gx >= gridWidth || gy >= gridHeight) return null
  return { x: gx, y: gy }
}
