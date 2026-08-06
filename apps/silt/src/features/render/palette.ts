import type { ElementRegistry } from '../../sim/index.ts'

/** RGB lookup table, 3 bytes per species id (0–255). */
export type Palette = Uint8ClampedArray

/** Letterbox-margin / empty-cell colour — spec §6, §9 `world` token. */
export const WORLD_COLOUR = '#181510'

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/**
 * One colour per species id, straight from the registry so the rail and the
 * grid can never drift apart (spec §9). Ids the registry has nothing for
 * (there are none once EMPTY/WALL are registered, but the table stays total)
 * fall back to the world colour.
 */
export function buildPalette(registry: ElementRegistry): Palette {
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
