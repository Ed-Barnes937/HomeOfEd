import { describe, expect, it } from 'vitest'

import { relax } from './relax.ts'
import type { Box } from './types.ts'

/** Deterministic PRNG for the random scenes — never Math.random in tests. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Sum of pairwise AABB overlap areas — the scalar the dense scene must not worsen. */
function totalOverlap(boxes: Box[]): number {
  let sum = 0
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!
      const b = boxes[j]!
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
      if (ox > 0 && oy > 0) sum += ox * oy
    }
  }
  return sum
}

function anyOverlap(boxes: Box[]): boolean {
  return totalOverlap(boxes) > 1e-9
}

function inBounds(boxes: Box[], W: number, H: number): boolean {
  return boxes.every((b) => b.x >= -1e-9 && b.y >= -1e-9 && b.x <= W - b.w + 1e-9 && b.y <= H - b.h + 1e-9)
}

describe('relax — pair separation', () => {
  it('separates a horizontally-overlapping pair along x (smaller axis), splitting 50/50', () => {
    // full y overlap, 10px x overlap → separate along x
    const boxes: Box[] = [
      { id: 1, x: 100, y: 100, w: 100, h: 100 },
      { id: 2, x: 190, y: 100, w: 100, h: 100 },
    ]
    relax(boxes, null, 1000, 1000)
    expect(boxes[0]!.x).toBeCloseTo(95)
    expect(boxes[1]!.x).toBeCloseTo(195)
    expect(boxes[0]!.y).toBe(100)
    expect(boxes[1]!.y).toBe(100)
    expect(anyOverlap(boxes)).toBe(false)
  })

  it('honours centre order for the push sign (left box moves left, right box right)', () => {
    // b is the left box here → sign flips
    const boxes: Box[] = [
      { id: 1, x: 190, y: 100, w: 100, h: 100 },
      { id: 2, x: 100, y: 100, w: 100, h: 100 },
    ]
    relax(boxes, null, 1000, 1000)
    expect(boxes[0]!.x).toBeCloseTo(195)
    expect(boxes[1]!.x).toBeCloseTo(95)
  })

  it('separates a vertically-overlapping pair along y (smaller axis)', () => {
    // full x overlap, 10px y overlap → separate along y
    const boxes: Box[] = [
      { id: 1, x: 100, y: 100, w: 100, h: 100 },
      { id: 2, x: 100, y: 190, w: 100, h: 100 },
    ]
    relax(boxes, null, 1000, 1000)
    expect(boxes[0]!.y).toBeCloseTo(95)
    expect(boxes[1]!.y).toBeCloseTo(195)
    expect(boxes[0]!.x).toBe(100)
    expect(boxes[1]!.x).toBe(100)
  })
})

describe('relax — activeId is immovable', () => {
  it('never moves the active box; its partner takes the full push', () => {
    const boxes: Box[] = [
      { id: 1, x: 100, y: 100, w: 100, h: 100 },
      { id: 2, x: 190, y: 100, w: 100, h: 100 },
    ]
    relax(boxes, 1, 1000, 1000)
    expect(boxes[0]!.x).toBe(100) // active, untouched
    expect(boxes[1]!.x).toBeCloseTo(200) // full 10px push
    expect(anyOverlap(boxes)).toBe(false)
  })

  it('pushes the active box’s partner regardless of which slot is active', () => {
    const boxes: Box[] = [
      { id: 1, x: 100, y: 100, w: 100, h: 100 },
      { id: 2, x: 190, y: 100, w: 100, h: 100 },
    ]
    relax(boxes, 2, 1000, 1000)
    expect(boxes[1]!.x).toBe(190) // active, untouched
    expect(boxes[0]!.x).toBeCloseTo(90) // full 10px push, to the left
  })
})

describe('relax — chaining', () => {
  it('dominoes: dragging A into B shoves B, which shoves C', () => {
    const initialB = 160
    const initialC = 220
    const boxes: Box[] = [
      { id: 1, x: 100, y: 100, w: 100, h: 100 }, // A, dragged
      { id: 2, x: initialB, y: 100, w: 100, h: 100 }, // B
      { id: 3, x: initialC, y: 100, w: 100, h: 100 }, // C
    ]
    relax(boxes, 1, 2000, 1000)
    expect(boxes[0]!.x).toBe(100) // A immovable
    expect(boxes[1]!.x).toBeGreaterThan(initialB) // B shoved right
    expect(boxes[2]!.x).toBeGreaterThan(initialC) // C shoved right by B
  })
})

describe('relax — random scenes', () => {
  it('fully separates a sparse scene within 7 passes', () => {
    const rng = mulberry32(12345)
    const W = 1200
    const H = 1200
    const boxes: Box[] = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      x: rng() * (W - 40),
      y: rng() * (H - 40),
      w: 40,
      h: 40,
    }))
    relax(boxes, null, W, H)
    expect(anyOverlap(boxes)).toBe(false)
    expect(inBounds(boxes, W, H)).toBe(true)
  })

  it('never increases total overlap in a dense (jammed) scene, and keeps every box in bounds', () => {
    const rng = mulberry32(999)
    const W = 300
    const H = 300
    const boxes: Box[] = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      x: rng() * (W - 60),
      y: rng() * (H - 60),
      w: 60,
      h: 60,
    }))
    const before = totalOverlap(boxes)
    relax(boxes, null, W, H)
    const after = totalOverlap(boxes)
    expect(after).toBeLessThanOrEqual(before)
    expect(inBounds(boxes, W, H)).toBe(true)
  })
})
