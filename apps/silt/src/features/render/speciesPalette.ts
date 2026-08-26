import { BYTES_PER_CELL, SPECIES_OFFSET } from '../../sim/index.ts'
import type { ElementRegistry } from '../../sim/index.ts'

/** RGB lookup table, 3 bytes per species id (0–255). */
export type SpeciesPalette = Uint8ClampedArray

/** Letterbox-margin / empty-cell colour — spec §6, §9 `world` token. */
export const WORLD_COLOUR = '#181510'

export function hexToRgb(hex: string): [number, number, number] {
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
 * The palette as 256×1 RGBA texture data (one texel per species id, opaque) —
 * what the WebGL renderer uploads so its fragment shader looks colours up in
 * the same registry-derived table the 2D path rasterises from.
 */
export function packPaletteTexture(palette: SpeciesPalette): Uint8Array {
  const texture = new Uint8Array(256 * 4)
  for (let id = 0; id < 256; id++) {
    texture[id * 4] = palette[id * 3] ?? 0
    texture[id * 4 + 1] = palette[id * 3 + 1] ?? 0
    texture[id * 4 + 2] = palette[id * 3 + 2] ?? 0
    texture[id * 4 + 3] = 255
  }
  return texture
}

/**
 * CPU rasterise: one opaque RGBA pixel per interleaved 4-byte cell, colour
 * from the species byte. The 2D renderer runs this every frame; the WebGL
 * renderer only for `snapshot()` (scene thumbnails, off the frame path).
 */
export function rasteriseSpecies(
  cells: Uint8Array,
  palette: SpeciesPalette,
  pixels: Uint8ClampedArray,
): void {
  for (let cell = 0, i = SPECIES_OFFSET; i < cells.length; i += BYTES_PER_CELL, cell++) {
    const species = cells[i] ?? 0
    const c = species * 3
    const p = cell * 4
    pixels[p] = palette[c] ?? 0
    pixels[p + 1] = palette[c + 1] ?? 0
    pixels[p + 2] = palette[c + 2] ?? 0
    pixels[p + 3] = 255
  }
}
