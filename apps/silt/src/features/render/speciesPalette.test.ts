import { describe, expect, it } from 'vitest'

import {
  createRegistry,
  DIRT,
  EMPTY,
  SAND,
  SMOKE,
  v1Elements,
  v1Reactions,
} from '../../sim/index.ts'
import {
  buildPackedSpeciesPalette,
  buildSpeciesPalette,
  hexToRgb,
  packPaletteTexture,
  paletteSlot,
  rasteriseSpecies,
  VARIANT_SLOTS,
} from './speciesPalette.ts'

const registry = createRegistry(v1Elements, v1Reactions)
const palette = buildSpeciesPalette(registry)

const rgbAt = (slot: number) => [palette[slot * 3], palette[slot * 3 + 1], palette[slot * 3 + 2]]

describe('buildSpeciesPalette', () => {
  it('fills every species eight slots, cycling its declared colours', () => {
    expect(palette).toHaveLength(256 * VARIANT_SLOTS * 3)

    const colours = registry.get(SAND)!.colours
    expect(colours.length).toBeGreaterThan(1)
    for (let variant = 0; variant < VARIANT_SLOTS; variant++) {
      expect(rgbAt(paletteSlot(SAND, variant))).toEqual(hexToRgb(colours[variant % colours.length]!))
    }
  })

  it('leaves a single-colour species flat across all eight slots', () => {
    expect(registry.get(SMOKE)!.colours).toHaveLength(1)

    const flat = hexToRgb(registry.get(SMOKE)!.colours[0]!)
    for (let variant = 0; variant < VARIANT_SLOTS; variant++) {
      expect(rgbAt(paletteSlot(SMOKE, variant))).toEqual(flat)
    }
  })

  it('keeps slot 0 on the rail colour, so the two can never drift', () => {
    for (const def of registry.all()) {
      expect(rgbAt(paletteSlot(def.id, 0))).toEqual(hexToRgb(def.colours[0]!))
    }
  })
})

describe('paletteSlot', () => {
  it('takes the low three bits of rb, so a full random byte lands in range', () => {
    expect(paletteSlot(SAND, 0)).toBe(SAND * VARIANT_SLOTS)
    expect(paletteSlot(SAND, 8)).toBe(paletteSlot(SAND, 0))
    expect(paletteSlot(SAND, 255)).toBe(SAND * VARIANT_SLOTS + 7)
  })
})

describe('packPaletteTexture', () => {
  it('packs the palette into RGBA texture data, one texel per variant slot', () => {
    const texture = packPaletteTexture(palette)

    expect(texture).toHaveLength(256 * VARIANT_SLOTS * 4)
    for (let slot = 0; slot < 256 * VARIANT_SLOTS; slot++) {
      expect(texture[slot * 4]).toBe(palette[slot * 3])
      expect(texture[slot * 4 + 1]).toBe(palette[slot * 3 + 1])
      expect(texture[slot * 4 + 2]).toBe(palette[slot * 3 + 2])
      expect(texture[slot * 4 + 3]).toBe(255)
    }
  })
})

describe('rasteriseSpecies', () => {
  it('writes each cell colour as an opaque RGBA pixel, shaded by its rb', () => {
    // Three interleaved 4-byte cells: EMPTY, then the same species twice with
    // rb bytes that land in different variant slots.
    const cells = new Uint8Array([EMPTY, 7, 9, 11, SAND, 1, 0, 3, SAND, 1, 9, 3])
    const pixels = new Uint8ClampedArray(3 * 4)

    rasteriseSpecies(cells, palette, pixels)

    for (const [cell, slot] of [
      [0, paletteSlot(EMPTY, 9)],
      [1, paletteSlot(SAND, 0)],
      [2, paletteSlot(SAND, 9)],
    ] as const) {
      expect([pixels[cell * 4], pixels[cell * 4 + 1], pixels[cell * 4 + 2]]).toEqual(rgbAt(slot))
      expect(pixels[cell * 4 + 3]).toBe(255)
    }
    // Same species, different rb — the point of the whole ticket.
    expect(pixels[1 * 4]).not.toBe(pixels[2 * 4])
  })
})

describe('packed species palette', () => {
  it('packs each slot so the bytes land R, G, B, 255 in memory order', () => {
    const packed = buildPackedSpeciesPalette(registry)

    expect(packed).toHaveLength(256 * VARIANT_SLOTS)

    // The overlay is what the renderer's ImageData actually is: whatever byte
    // order this machine writes a 32-bit word in, slot 0 must be red and slot 3
    // must be opaque. Reading the word back numerically would only re-assert
    // the packing arithmetic, not that it is right for this endianness.
    const overlay = new Uint8ClampedArray(packed.buffer)
    for (const slot of [0, paletteSlot(DIRT, 0), paletteSlot(DIRT, 5), 256 * VARIANT_SLOTS - 1]) {
      expect([
        overlay[slot * 4],
        overlay[slot * 4 + 1],
        overlay[slot * 4 + 2],
        overlay[slot * 4 + 3],
      ]).toEqual([...rgbAt(slot), 255])
    }
  })
})
