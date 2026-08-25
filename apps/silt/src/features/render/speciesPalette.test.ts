import { describe, expect, it } from 'vitest'

import { createRegistry, DIRT, v1Elements, v1Reactions } from '../../sim/index.ts'
import { buildPackedSpeciesPalette, buildSpeciesPalette } from './speciesPalette.ts'

describe('packed species palette', () => {
  it('packs each species so the bytes land R, G, B, 255 in memory order', () => {
    const registry = createRegistry(v1Elements, v1Reactions)
    const bytes = buildSpeciesPalette(registry)
    const packed = buildPackedSpeciesPalette(registry)

    expect(packed).toHaveLength(256)

    // The overlay is what the renderer's ImageData actually is: whatever byte
    // order this machine writes a 32-bit word in, slot 0 must be red and slot 3
    // must be opaque. Reading the word back numerically would only re-assert
    // the packing arithmetic, not that it is right for this endianness.
    const overlay = new Uint8ClampedArray(packed.buffer)
    for (const id of [0, DIRT, 255]) {
      expect([overlay[id * 4], overlay[id * 4 + 1], overlay[id * 4 + 2], overlay[id * 4 + 3]]).toEqual([
        bytes[id * 3],
        bytes[id * 3 + 1],
        bytes[id * 3 + 2],
        255,
      ])
    }
  })
})
