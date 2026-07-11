import { describe, expect, it } from 'vitest'

import { findOpenPlacement } from './place.ts'
import type { Box, Placement, Size } from './types.ts'

const W = 600
const H = 400
const size: Size = { w: 52, h: 60 }
const preferred: Placement = { x: 274, y: 87, rot: 3 }

/** Strict AABB overlap — the returned spot must not sit on any existing box. */
function overlapsAny(x: number, y: number, s: Size, boxes: Box[]): boolean {
  return boxes.some(
    (b) => x < b.x + b.w && x + s.w > b.x && y < b.y + b.h && y + s.h > b.y,
  )
}

describe('findOpenPlacement', () => {
  it('returns the preferred point (clamped) on an empty board, preserving rot', () => {
    const p = findOpenPlacement([], W, H, size, preferred)
    expect(p).toEqual({ x: 274, y: 87, rot: 3 })
  })

  it('keeps the preferred point when it is already clear', () => {
    const boxes: Box[] = [{ id: 1, x: 10, y: 300, w: 52, h: 60 }] // far away
    const p = findOpenPlacement(boxes, W, H, size, preferred)
    expect(p).toEqual({ x: 274, y: 87, rot: 3 })
  })

  it('finds a nearby gap (no overlap, in bounds) when the preferred point is blocked', () => {
    const boxes: Box[] = [{ id: 1, x: 230, y: 50, w: 120, h: 120 }] // covers preferred
    const p = findOpenPlacement(boxes, W, H, size, preferred)
    expect(overlapsAny(p.x, p.y, size, boxes)).toBe(false)
    expect(p.x).toBeGreaterThanOrEqual(0)
    expect(p.y).toBeGreaterThanOrEqual(0)
    expect(p.x).toBeLessThanOrEqual(W - size.w)
    expect(p.y).toBeLessThanOrEqual(H - size.h)
    expect(p.rot).toBe(3) // tilt is preserved from the preferred point
  })

  it('falls back to the preferred point verbatim when the board is full', () => {
    const full: Box[] = [{ id: 1, x: 0, y: 0, w: 100, h: 100 }]
    const pref: Placement = { x: 10, y: 10, rot: 2 }
    const p = findOpenPlacement(full, 100, 100, { w: 100, h: 100 }, pref)
    expect(p).toEqual(pref)
  })

  it('does not mutate the input boxes', () => {
    const boxes: Box[] = [{ id: 1, x: 230, y: 50, w: 120, h: 120 }]
    const snapshot = boxes.map((b) => ({ ...b }))
    findOpenPlacement(boxes, W, H, size, preferred)
    expect(boxes).toEqual(snapshot)
  })
})
