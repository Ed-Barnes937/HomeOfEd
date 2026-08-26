import { describe, expect, it } from 'vitest'

import { createRegistry, DIRT, EMPTY, SAND, v1Elements, v1Reactions } from '../../sim/index.ts'
import {
  buildPackedSpeciesPalette,
  buildSpeciesPalette,
  packPaletteTexture,
  rasteriseSpecies,
} from './speciesPalette.ts'

const registry = createRegistry(v1Elements, v1Reactions)
const palette = buildSpeciesPalette(registry)

describe('packPaletteTexture', () => {
  it('packs the 256-entry RGB palette into RGBA texture data, one texel per species id', () => {
    const texture = packPaletteTexture(palette)

    expect(texture).toHaveLength(256 * 4)
    for (let id = 0; id < 256; id++) {
      expect(texture[id * 4]).toBe(palette[id * 3])
      expect(texture[id * 4 + 1]).toBe(palette[id * 3 + 1])
      expect(texture[id * 4 + 2]).toBe(palette[id * 3 + 2])
      expect(texture[id * 4 + 3]).toBe(255)
    }
  })
})

describe('rasteriseSpecies', () => {
  it('writes each cell species colour as an opaque RGBA pixel', () => {
    // Two interleaved 4-byte cells: EMPTY then SAND, with ra/rb/clock noise
    // the rasteriser must ignore.
    const cells = new Uint8Array([EMPTY, 7, 9, 11, SAND, 1, 2, 3])
    const pixels = new Uint8ClampedArray(2 * 4)

    rasteriseSpecies(cells, palette, pixels)

    for (const [cell, species] of [
      [0, EMPTY],
      [1, SAND],
    ] as const) {
      expect(pixels[cell * 4]).toBe(palette[species * 3])
      expect(pixels[cell * 4 + 1]).toBe(palette[species * 3 + 1])
      expect(pixels[cell * 4 + 2]).toBe(palette[species * 3 + 2])
      expect(pixels[cell * 4 + 3]).toBe(255)
    }
  })
})

describe('packed species palette', () => {
  it('packs each species so the bytes land R, G, B, 255 in memory order', () => {
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
