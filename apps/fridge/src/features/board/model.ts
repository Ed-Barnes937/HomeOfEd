import type { Box } from '@hoe/magnet-kit'

/** Magnet kinds in v1 — letters, numbers, fraction discs (no word tiles). */
export type MagnetType = 'letter' | 'number' | 'fraction'

/** The six magnet colours; `auto` cycles these keys in this order. */
export type PaletteKey = 'red' | 'blue' | 'green' | 'yellow' | 'orange' | 'purple'

/** Fridge door finish; `steel` is the bare door, the rest are overlays. */
export type Finish = 'steel' | 'white' | 'red' | 'mint'

/** Kitchen-light tint over the whole page. */
export type Wall = 'warm' | 'cool' | 'dark'

/** A colour's three shades — the main fill, the extruded side, the highlight. */
export interface PaletteShades {
  main: string
  dark: string
  light: string
}

/**
 * A magnet at runtime. Extends the engine's {@link Box} (id/x/y/w/h) with the
 * app-owned fields; w/h are derived from {@link sizeFor}, never stored.
 */
export interface Magnet extends Box {
  type: MagnetType
  label: string // 'A'–'Z' | '0'–'9'; '' for fractions
  deg: number // fractions only (light wedge sweep); 0 otherwise
  color: PaletteKey
  rot: number
  z: number
}

/** Palette order is the auto-cycle order (red → blue → … → purple). */
export const PALETTE_ORDER: PaletteKey[] = ['red', 'blue', 'green', 'yellow', 'orange', 'purple']

/** The six shade triples, verbatim from the handoff's tokens.css. */
export const PALETTE: Record<PaletteKey, PaletteShades> = {
  red: { main: '#e8503a', dark: '#a12b1d', light: '#ff9179' },
  blue: { main: '#2f7fd6', dark: '#194f8f', light: '#83bdf5' },
  green: { main: '#3fae6b', dark: '#1f7343', light: '#8ee2ab' },
  yellow: { main: '#f0b429', dark: '#a9760f', light: '#ffdd7a' },
  orange: { main: '#ef8a35', dark: '#a9560f', light: '#ffc389' },
  purple: { main: '#8a5cd1', dark: '#553497', light: '#c4a6f2' },
}

/** The Shapes tab: glyph → light-wedge sweep in degrees (¼ ⅓ ½ ¾ ●). */
export const FRACTIONS: { glyph: string; deg: number }[] = [
  { glyph: '¼', deg: 90 },
  { glyph: '⅓', deg: 120 },
  { glyph: '½', deg: 180 },
  { glyph: '¾', deg: 270 },
  { glyph: '●', deg: 360 },
]

/** Box dimensions per magnet type (prototype values). Recomputed on load. */
export function sizeFor(type: MagnetType): { w: number; h: number } {
  if (type === 'fraction') return { w: 64, h: 64 }
  if (type === 'number') return { w: 50, h: 60 }
  return { w: 52, h: 60 }
}
