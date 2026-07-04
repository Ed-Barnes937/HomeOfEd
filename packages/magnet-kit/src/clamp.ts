import type { Box } from './types.ts'

/**
 * Clamp a box inside the bounds, in place: x → [0, boundsW - b.w] and
 * y → [0, boundsH - b.h] (the prototype's clampOne). Mutates `b`.
 */
export function clampOne(b: Box, boundsW: number, boundsH: number): void {
  b.x = Math.max(0, Math.min(boundsW - b.w, b.x))
  b.y = Math.max(0, Math.min(boundsH - b.h, b.y))
}
