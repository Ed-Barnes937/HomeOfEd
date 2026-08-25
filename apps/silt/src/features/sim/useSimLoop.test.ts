import { describe, expect, it } from 'vitest'

import { BRUSH_WIDTHS } from '../palette/paletteGroups.ts'
import { brushOffsets } from './useSimLoop.ts'

/** `Int8Array` of flat `[dx, dy, …]` back to pairs, for readable expectations. */
function pairs(offsets: Int8Array): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < offsets.length; i += 2) out.push([offsets[i]!, offsets[i + 1]!])
  return out
}

describe('brushOffsets', () => {
  it('is a single centred cell at width 1', () => {
    expect(pairs(brushOffsets(1))).toEqual([[0, 0]])
  })

  it('covers a centred square at width 3', () => {
    expect(pairs(brushOffsets(3))).toEqual([
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [0, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ])
  })

  it('covers width² cells for every brush the rail offers', () => {
    for (const width of BRUSH_WIDTHS) {
      const offsets = brushOffsets(width)
      expect(offsets.length).toBe(width * width * 2)
      // Centred: the middle pair of an odd square is the pointer's own cell.
      expect(pairs(offsets)).toContainEqual([0, 0])
    }
  })

  it('still splits an even width floor/ceil rather than assuming a centre', () => {
    // BRUSH_WIDTHS is all odd today; the function deliberately does not rely on
    // that, so width 4 spans -1..2 on both axes — 16 cells, no centre.
    const offsets = brushOffsets(4)
    expect(offsets.length).toBe(4 * 4 * 2)
    const xs = pairs(offsets).map(([dx]) => dx)
    expect(Math.min(...xs)).toBe(-1)
    expect(Math.max(...xs)).toBe(2)
  })

  it('memoises per width, so a drag allocates nothing', () => {
    expect(brushOffsets(7)).toBe(brushOffsets(7))
    expect(brushOffsets(7)).not.toBe(brushOffsets(5))
  })
})
