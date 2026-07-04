import { clampOne } from './clamp.ts'
import type { Box } from './types.ts'

/**
 * Separate one overlapping pair along the given axis by `amt`, in place.
 * The pair member whose id === activeId is immovable — its partner takes the
 * full push; otherwise the push splits 50/50. Direction is set by `sign`.
 */
function push(
  a: Box,
  b: Box,
  ax: 'x' | 'y',
  amt: number,
  sign: number,
  activeId: number | null,
): void {
  const aActive = a.id === activeId
  const bActive = b.id === activeId
  if (bActive) {
    a[ax] -= sign * amt
  } else if (aActive) {
    b[ax] += sign * amt
  } else {
    a[ax] -= (sign * amt) / 2
    b[ax] += (sign * amt) / 2
  }
}

/**
 * The core "bump": for `passes` iterations, resolve every overlapping pair by
 * separating along the smaller-overlap axis (direction by centre comparison),
 * then clamp every box back into bounds. Mutates `boxes` in place. The box with
 * id === activeId never moves, so the dragged magnet shoves its neighbours.
 */
export function relax(
  boxes: Box[],
  activeId: number | null,
  boundsW: number,
  boundsH: number,
  passes = 7,
): void {
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!
        const b = boxes[j]!
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
        if (ox > 0 && oy > 0) {
          if (ox < oy) {
            const sign = a.x + a.w / 2 < b.x + b.w / 2 ? 1 : -1
            push(a, b, 'x', ox, sign, activeId)
          } else {
            const sign = a.y + a.h / 2 < b.y + b.h / 2 ? 1 : -1
            push(a, b, 'y', oy, sign, activeId)
          }
        }
      }
    }
    for (const b of boxes) clampOne(b, boundsW, boundsH)
  }
}
