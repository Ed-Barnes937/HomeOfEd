/**
 * Coordinate fitting — the logical↔device mapping that lets resize/rotate
 * preserve the drawing without distortion (spec §4). PURE TS — no DOM/Canvas.
 *
 * The drawing lives in a logical `ViewBox`. On render we compute a uniform
 * contain-fit of that viewBox into the live canvas CSS size (preserve aspect,
 * centred) — no letterboxing of the paper, only the ink is fitted.
 */
import type { Point, ViewBox } from './types.ts'

export interface Fit {
  scale: number
  offsetX: number
  offsetY: number
}

/** Uniform contain-fit of `vb` into a `cssW × cssH` canvas, centred. */
export function computeFit(vb: ViewBox, cssW: number, cssH: number): Fit {
  const scale = Math.min(cssW / vb.width, cssH / vb.height)
  return {
    scale,
    offsetX: (cssW - vb.width * scale) / 2,
    offsetY: (cssH - vb.height * scale) / 2,
  }
}

/** Logical → device (css px). */
export function toDevice(p: Point, fit: Fit): Point {
  return {
    x: p.x * fit.scale + fit.offsetX,
    y: p.y * fit.scale + fit.offsetY,
  }
}

/** Device (css px) → logical. */
export function toLogical(p: Point, fit: Fit): Point {
  return {
    x: (p.x - fit.offsetX) / fit.scale,
    y: (p.y - fit.offsetY) / fit.scale,
  }
}
