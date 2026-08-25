import { describe, expect, it } from 'vitest'

import { fractionInSegment, segmentAt, type ScrubSegment } from './scrubGeometry.ts'

/** `count` segments of `width`, laid out left to right on `gap` — a scrub track. */
function track(count: number, width: number, gap: number): ScrubSegment[] {
  return Array.from({ length: count }, (_, i) => ({ left: i * (width + gap), width }))
}

describe('segmentAt', () => {
  // The laptop song strip: 16 cells of 56px on an 8px gap.
  const cells = track(16, 56, 8)

  it('takes the segment the pointer is inside, not the nearest edge', () => {
    // Every pixel of a cell is that cell — the whole point of the rule
    // (spec §4): snapping to the nearest *line* would halve the end targets.
    expect(segmentAt(cells, 0)).toBe(0)
    expect(segmentAt(cells, 55)).toBe(0)
    expect(segmentAt(cells, 64)).toBe(1)
    expect(segmentAt(cells, 15 * 64 + 55)).toBe(15)
  })

  it('takes the nearer neighbour when the pointer lands in a gap', () => {
    // The gap after cell 0 runs 56–63; its own midpoint decides.
    expect(segmentAt(cells, 57)).toBe(0)
    expect(segmentAt(cells, 62)).toBe(1)
  })

  it('clamps off either end of the track', () => {
    expect(segmentAt(cells, -200)).toBe(0)
    expect(segmentAt(cells, 5000)).toBe(15)
  })

  it('has no segment to name on an empty track', () => {
    expect(segmentAt([], 40)).toBeNull()
  })
})

describe('fractionInSegment', () => {
  it('reads how far across a segment the pointer sits, 0 up to just under 1', () => {
    const cell: ScrubSegment = { left: 128, width: 56 }
    expect(fractionInSegment(cell, 128)).toBe(0)
    expect(fractionInSegment(cell, 128 + 28)).toBeCloseTo(0.5)
    expect(fractionInSegment(cell, 128 + 55)).toBeLessThan(1)
  })

  it('clamps outside the segment, so a gap or an over-drag still answers', () => {
    const cell: ScrubSegment = { left: 128, width: 56 }
    expect(fractionInSegment(cell, 0)).toBe(0)
    expect(fractionInSegment(cell, 9000)).toBeLessThan(1)
  })

  it('reads a zero-width segment as its start rather than dividing by zero', () => {
    expect(fractionInSegment({ left: 10, width: 0 }, 10)).toBe(0)
  })
})
