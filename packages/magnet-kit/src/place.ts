import type { Box, Placement, Size } from './types.ts'

/** True if a box at (x,y) of `size` comes within `gap` of any existing box. */
function collides(x: number, y: number, size: Size, boxes: Box[], gap: number): boolean {
  return boxes.some(
    (b) =>
      x < b.x + b.w + gap &&
      x + size.w + gap > b.x &&
      y < b.y + b.h + gap &&
      y + size.h + gap > b.y,
  )
}

/**
 * Find a spot for a new magnet that doesn't disturb the ones already placed:
 * start at the `preferred` spawn point and, if it's occupied, search a grid of
 * candidate positions (nearest-to-preferred first) for the closest clear one.
 * Each candidate must clear existing boxes by `gap` px so the caller's relax()
 * finds nothing to push. Pure — never mutates `boxes`.
 *
 * Full-board fallback: if no clear spot exists, return the (unclamped) preferred
 * point unchanged, so the caller's relax() shoves neighbours as it does today.
 */
export function findOpenPlacement(
  boxes: Box[],
  boundsW: number,
  boundsH: number,
  size: Size,
  preferred: Placement,
  gap = 6,
): Placement {
  const maxX = boundsW - size.w
  const maxY = boundsH - size.h
  const clamp = (v: number, max: number): number => Math.max(0, Math.min(max, v))

  const px = clamp(preferred.x, maxX)
  const py = clamp(preferred.y, maxY)
  if (!collides(px, py, size, boxes, gap)) return { x: px, y: py, rot: preferred.rot }

  // Grid scan over every candidate top-left, ordered by distance from the
  // preferred point, so the gap nearest the top-centre wins.
  const step = Math.max(12, Math.min(size.w, size.h) / 2)
  const candidates: { x: number; y: number; d: number }[] = []
  for (let y = 0; y <= maxY; y += step) {
    for (let x = 0; x <= maxX; x += step) {
      candidates.push({ x, y, d: (x - px) ** 2 + (y - py) ** 2 })
    }
  }
  candidates.sort((a, b) => a.d - b.d)
  for (const c of candidates) {
    if (!collides(c.x, c.y, size, boxes, gap)) return { x: c.x, y: c.y, rot: preferred.rot }
  }

  // Full board — no gap. Fall back to the preferred point so relax() shoves.
  return { x: preferred.x, y: preferred.y, rot: preferred.rot }
}
