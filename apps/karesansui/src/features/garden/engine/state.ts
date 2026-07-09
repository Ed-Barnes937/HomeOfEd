/**
 * The garden's configuration — the "device" the user assembles: a ring, a gear
 * train (1..3 wheels), the pin offset, a rake head, and the run parameters.
 * Pure data + fixed-range clamp helpers. No React, no DOM. The setters that
 * apply these clamps (and re-derive `turns`) live in the page layer.
 */
export type RakeId = 'marble' | 'wide' | 'deep' | 'fine'

export interface GardenConfig {
  ring: number // one of ringOpts(): 96 | 120 | 144
  wheels: number[] // 1..3 entries, each in wheelOpts()
  offset: number // pin offset, 0.08..0.94 (the "r" value)
  rake: RakeId
  speed: number // 0..100 (maps to carve duration)
  turns: number // 1..fullTurns
  showPreview: boolean
}

export const DEFAULT_CONFIG: GardenConfig = {
  ring: 96,
  wheels: [52],
  offset: 0.66,
  rake: 'wide',
  speed: 58,
  turns: 13,
  showPreview: true,
}

/** Pin offset slider bounds (reference range 8..94, stored as 0.08..0.94). */
export const OFFSET_MIN = 0.08
export const OFFSET_MAX = 0.94

/** Speed slider bounds (0 = meditative, 100 = brisk). */
export const SPEED_MIN = 0
export const SPEED_MAX = 100

/** Clamp the pin offset to its slider range; non-finite falls back to default. */
export function clampOffset(value: number): number {
  const n = Number.isFinite(value) ? value : DEFAULT_CONFIG.offset
  return Math.min(OFFSET_MAX, Math.max(OFFSET_MIN, n))
}

/** Clamp the speed to its slider range; non-finite falls back to default. */
export function clampSpeed(value: number): number {
  const n = Number.isFinite(value) ? value : DEFAULT_CONFIG.speed
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, n))
}
