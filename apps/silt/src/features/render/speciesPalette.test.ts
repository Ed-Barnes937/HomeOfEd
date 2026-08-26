import { describe, expect, it } from 'vitest'

import { createRegistry, SAND, v1Elements, v1Reactions, EMPTY } from '../../sim/index.ts'
import { buildSpeciesPalette, packPaletteTexture, rasteriseSpecies } from './speciesPalette.ts'

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
