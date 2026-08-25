import type { ElementRegistry } from '../../sim/index.ts'

/** RGB lookup table, 3 bytes per species id (0–255). */
export type SpeciesPalette = Uint8ClampedArray

/**
 * The same table as one opaque 32-bit word per species id — what the renderer
 * stores straight into a `Uint32Array` view over its `ImageData` (ticket 06).
 */
export type PackedSpeciesPalette = Uint32Array

/** Letterbox-margin / empty-cell colour — spec §6, §9 `world` token. */
export const WORLD_COLOUR = '#181510'

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/**
 * One colour per species id, straight from the registry — the same registry
 * `buildRailPalette` (../palette/paletteGroups.ts) reads for the rail, so the
 * two can never drift apart (spec §9, ticket 16). Ids the registry has
 * nothing for (there are none once EMPTY/WALL are registered, but the table
 * stays total) fall back to the world colour.
 */
export function buildSpeciesPalette(registry: ElementRegistry): SpeciesPalette {
  const palette = new Uint8ClampedArray(256 * 3)
  const world = hexToRgb(WORLD_COLOUR)
  for (let id = 0; id < 256; id++) {
    const def = registry.get(id)
    const [r, g, b] = def ? hexToRgb(def.colours[0] ?? WORLD_COLOUR) : world
    palette[id * 3] = r
    palette[id * 3 + 1] = g
    palette[id * 3 + 2] = b
  }
  return palette
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
  const packed = new Uint32Array(256)
  for (let id = 0; id < 256; id++) {
    const r = bytes[id * 3]!
    const g = bytes[id * 3 + 1]!
    const b = bytes[id * 3 + 2]!
    packed[id] = LITTLE_ENDIAN
      ? ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0
      : ((r << 24) | (g << 16) | (b << 8) | 0xff) >>> 0
  }
  return packed
}
