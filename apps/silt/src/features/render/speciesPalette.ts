import { BYTES_PER_CELL, RB_OFFSET, SPECIES_OFFSET, VARIANT_SLOTS } from '../../sim/index.ts'
import type { ElementRegistry } from '../../sim/index.ts'

/**
 * Re-exported so the render side has one import for the whole palette contract.
 * It lives in `sim/constants.ts` because the registry enforces it at boot —
 * `rb` is a sim byte, so the slot count is a shared contract rather than a
 * render-only detail. Being a power of two is what lets the variant be a mask
 * instead of a division; a species declaring 1, 2, 4 or 8 colours draws them in
 * exactly equal shares, and an odd count (3, 5…) leaves the leftover slots on
 * the earlier colours — a bias of one slot in eight, invisible and free.
 */
export { VARIANT_SLOTS }

/** RGB lookup table, 3 bytes per (species, variant) slot — 256 × `VARIANT_SLOTS`. */
export type SpeciesPalette = Uint8ClampedArray

/**
 * The same table as one opaque 32-bit word per slot — what the renderer stores
 * straight into a `Uint32Array` view over its `ImageData` (ticket 06).
 */
export type PackedSpeciesPalette = Uint32Array

/** Letterbox-margin / empty-cell colour — spec §6, §9 `world` token. */
export const WORLD_COLOUR = '#181510'

/**
 * Palette index for a cell. The low three bits of `rb` are the variant, so the
 * sim can store a full random byte and stay ignorant of how many colours an
 * element has. Both frame paths and the shader index the same way, which is
 * what the blit parity gate holds them to.
 *
 * This is called once per pixel by the 2D frame path. It stays a function
 * rather than a hand-inlined expression because V8 inlines it anyway — measured
 * at 0.652 vs 0.657 ms/frame over three runs of the blit bench, which is noise
 * — and one copy of the arithmetic is one fewer place to drift.
 */
export function paletteSlot(species: number, rb: number): number {
  // Multiply by a power-of-two constant, mask by one less: the engine turns
  // both into shifts, and neither term hard-codes the width.
  return species * VARIANT_SLOTS + (rb & (VARIANT_SLOTS - 1))
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/**
 * Every species' colours spread over its eight variant slots, straight from the
 * registry — the same registry `buildRailPalette` (../palette/paletteGroups.ts)
 * reads for the rail, so the two can never drift apart (spec §9, ticket 16).
 * Slot 0 is always `colours[0]`, which is the colour the rail shows.
 *
 * Colours shorter than eight repeat cyclically, so a single-colour species is
 * flat across all eight slots and renders exactly as it did before variants
 * existed. Ids the registry has nothing for (there are none once EMPTY/WALL are
 * registered, but the table stays total) fall back to the world colour.
 */
export function buildSpeciesPalette(registry: ElementRegistry): SpeciesPalette {
  const palette = new Uint8ClampedArray(256 * VARIANT_SLOTS * 3)
  for (let id = 0; id < 256; id++) {
    const declared = registry.get(id)?.colours
    const shades = (declared?.length ? declared : [WORLD_COLOUR]).map(hexToRgb)
    for (let variant = 0; variant < VARIANT_SLOTS; variant++) {
      const [r, g, b] = shades[variant % shades.length]!
      const slot = (id * VARIANT_SLOTS + variant) * 3
      palette[slot] = r
      palette[slot + 1] = g
      palette[slot + 2] = b
    }
  }
  return palette
}

/**
 * The palette as `VARIANT_SLOTS`×256 RGBA texture data (one texel per variant
 * slot, opaque, species on the y axis) — what the WebGL renderer uploads so its
 * fragment shader looks colours up in the same registry-derived table the 2D
 * path rasterises from. Texture rows are species, which is exactly the palette's
 * own layout, so `paletteSlot` addresses both.
 */
export function packPaletteTexture(palette: SpeciesPalette): Uint8Array {
  const slots = 256 * VARIANT_SLOTS
  const texture = new Uint8Array(slots * 4)
  for (let slot = 0; slot < slots; slot++) {
    texture[slot * 4] = palette[slot * 3] ?? 0
    texture[slot * 4 + 1] = palette[slot * 3 + 1] ?? 0
    texture[slot * 4 + 2] = palette[slot * 3 + 2] ?? 0
    texture[slot * 4 + 3] = 255
  }
  return texture
}

/**
 * CPU rasterise: one opaque RGBA pixel per interleaved 4-byte cell, colour from
 * the species byte shaded by the variant in `rb`. Off the frame path since
 * ticket 06 packed the 2D renderer's own loop — this remains for the WebGL
 * renderer's `snapshot()` (scene thumbnails, user-initiated).
 */
export function rasteriseSpecies(
  cells: Uint8Array,
  palette: SpeciesPalette,
  pixels: Uint8ClampedArray,
): void {
  for (let cell = 0, i = 0; i < cells.length; i += BYTES_PER_CELL, cell++) {
    const c = paletteSlot(cells[i + SPECIES_OFFSET] ?? 0, cells[i + RB_OFFSET] ?? 0) * 3
    const p = cell * 4
    pixels[p] = palette[c] ?? 0
    pixels[p + 1] = palette[c + 1] ?? 0
    pixels[p + 2] = palette[c + 2] ?? 0
    pixels[p + 3] = 255
  }
}

/**
 * True where a 32-bit store lands its low byte first — every browser silt runs
 * in, but detected rather than assumed: a packed `0xAABBGGRR` word is correct
 * on little-endian and has red and blue swapped on big-endian. One probe at
 * module load, so the rasterise loop pays nothing.
 */
const LITTLE_ENDIAN = (() => {
  const word = new Uint32Array(1)
  new Uint8Array(word.buffer)[0] = 1
  return word[0] === 1
})()

/**
 * `buildSpeciesPalette` as packed opaque pixels — one 32-bit store per cell in
 * the rasterise loop instead of four clamped byte stores (ticket 06). Byte
 * order follows the machine, so the bytes always land R, G, B, 255 in memory
 * whichever way this platform writes a word.
 */
export function buildPackedSpeciesPalette(registry: ElementRegistry): PackedSpeciesPalette {
  const bytes = buildSpeciesPalette(registry)
  const slots = 256 * VARIANT_SLOTS
  const packed = new Uint32Array(slots)
  for (let slot = 0; slot < slots; slot++) {
    const r = bytes[slot * 3]!
    const g = bytes[slot * 3 + 1]!
    const b = bytes[slot * 3 + 2]!
    packed[slot] = LITTLE_ENDIAN
      ? ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0
      : ((r << 24) | (g << 16) | (b << 8) | 0xff) >>> 0
  }
  return packed
}
