import { describe, expect, it } from 'vitest'

import { brushOffsets } from './brushOffsets.ts'

const has = (offsets: readonly { dx: number; dy: number }[], dx: number, dy: number) =>
  offsets.some((o) => o.dx === dx && o.dy === dy)

describe('brushOffsets', () => {
  it('width 1 is the single centre cell', () => {
    const offsets = brushOffsets(1)
    expect(offsets).toHaveLength(1)
    expect(has(offsets, 0, 0)).toBe(true)
  })

  it('width 3 fills the full 3x3 (the diameter-3 circle covers the diagonals)', () => {
    expect(brushOffsets(3)).toHaveLength(9)
  })

  it('width 5 is round: the four square corners are dropped', () => {
    const offsets = brushOffsets(5)
    expect(offsets).toHaveLength(21)
    const corners: [number, number][] = [
      [2, 2],
      [2, -2],
      [-2, 2],
      [-2, -2],
    ]
    for (const [dx, dy] of corners) {
      expect(has(offsets, dx, dy)).toBe(false)
    }
    // The straight edges at full radius stay in.
    expect(has(offsets, 2, 0)).toBe(true)
    expect(has(offsets, 0, -2)).toBe(true)
  })

  it('width 7 is round: corners out, cardinal extremes in', () => {
    const offsets = brushOffsets(7)
    expect(offsets).toHaveLength(37)
    expect(has(offsets, 3, 3)).toBe(false)
    expect(has(offsets, 2, 3)).toBe(false)
    expect(has(offsets, 3, 0)).toBe(true)
    expect(has(offsets, 2, 2)).toBe(true)
  })

  it('every footprint is symmetric about the centre', () => {
    for (const width of [1, 3, 5, 7]) {
      const offsets = brushOffsets(width)
      for (const { dx, dy } of offsets) {
        expect(has(offsets, -dx, -dy)).toBe(true)
      }
    }
  })
})
