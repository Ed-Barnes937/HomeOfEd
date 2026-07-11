/**
 * The fixed logical canvas (ADR 0022). Magnet `x`/`y`/`w`/`h` are absolute px
 * inside this constant space — never against the measured DOM surface — so a
 * shared board is pixel-identical on every device. The door is rendered at its
 * logical size and fit into the available stage with a single uniform
 * `transform: scale()`; pointer math divides client deltas by that scale.
 *
 * 1080×720 (3:2) is ≥ the old ~1046×634 authoring bounds, so every existing
 * shared board falls inside it and renders in place with no migration.
 */
export const CANVAS_W = 1080
export const CANVAS_H = 720

/** The door wraps the surface with a 7px inset all round (FridgeDoor.scss). */
export const DOOR_W = CANVAS_W + 14 // 1094
export const DOOR_H = CANVAS_H + 14 // 734

/** View-only zoom bounds for mobile editing (1 = the canonical fit view). */
export const MIN_ZOOM = 1
export const MAX_ZOOM = 4

/** Breathing room (px) kept around the door inside the stage. */
const FIT_GUTTER = 16
/** The door never renders larger than its logical size. */
const MAX_FIT = 1

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/**
 * The uniform scale that fits the logical door into the stage, letterboxed.
 * Capped at 1 so the door never renders bigger than its logical size.
 * Returns 0 when the stage has no usable room (pre-measure).
 */
export function computeFitScale(stageW: number, stageH: number): number {
  const availW = stageW - FIT_GUTTER
  const availH = stageH - FIT_GUTTER
  if (availW <= 0 || availH <= 0) return 0
  return Math.min(MAX_FIT, availW / DOOR_W, availH / DOOR_H)
}

export interface SurfaceRect {
  left: number
  top: number
  width: number
}

/**
 * Client coords → logical canvas coords, through the measured surface rect.
 * `scale = rect.width / CANVAS_W` folds in BOTH the fit scale and any view
 * zoom/pan, because they are all CSS transforms reflected in the surface's
 * on-screen rect — so a magnet tracks the finger/cursor exactly at any zoom.
 */
export function toLogical(
  rect: SurfaceRect,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const scale = rect.width / CANVAS_W
  return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale }
}

/**
 * Clamp a view pan (logical px) so the scaled door can't be dragged off the
 * frame: zero room when the door fits (fit view), otherwise half the overflow.
 * `scale` is the total render scale (fit × zoom).
 */
export function clampPan(
  pan: { x: number; y: number },
  scale: number,
  stageW: number,
  stageH: number,
): { x: number; y: number } {
  const maxX = Math.max(0, (DOOR_W - stageW / scale) / 2)
  const maxY = Math.max(0, (DOOR_H - stageH / scale) / 2)
  return { x: clamp(pan.x, -maxX, maxX), y: clamp(pan.y, -maxY, maxY) }
}
