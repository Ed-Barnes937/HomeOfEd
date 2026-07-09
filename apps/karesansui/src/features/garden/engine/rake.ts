/**
 * Rake-head presets — the four carving tools. Ported verbatim from the Studio
 * reference. Pure data: `tines` fingers spaced `spacing` apart, drawn at line
 * width `lw`, groove `spread`, and highlight `light`. No React, no DOM.
 */
import type { RakeId } from './state.ts'

export interface RakePreset {
  tines: number
  spacing: number
  lw: number
  spread: number
  light: number
}

export function rakePresets(): Record<RakeId, RakePreset> {
  return {
    marble: { tines: 1, spacing: 0, lw: 3.2, spread: 3.4, light: 1.6 },
    wide: { tines: 4, spacing: 4.6, lw: 2.1, spread: 1.6, light: 0.9 },
    deep: { tines: 3, spacing: 8.0, lw: 3.4, spread: 3.2, light: 1.7 },
    fine: { tines: 7, spacing: 2.7, lw: 1.15, spread: 0.9, light: 0.6 },
  }
}
