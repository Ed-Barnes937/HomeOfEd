/**
 * The garden's configuration — the "device" the user assembles: a ring, a gear
 * train (1..4 cogs, each its own pen), the global pin offset, the draw speed,
 * and whether the clearing rake loops. Pure data + fixed-range clamp helpers.
 * No React, no DOM. The setters that apply these clamps live in the page layer.
 */
export interface GardenConfig {
  ring: number // one of ringOpts(): 96 | 120 | 144
  wheels: number[] // 1..4 entries, each in wheelOpts() — one marble per cog
  offset: number // global pin offset, 0.08..0.94 (scales every marble)
  speed: number // 0..100 (maps to draw duration)
  showPreview: boolean
  clearingRake: boolean // when on, the loop draws → sweep-clears → redraws forever (plan 0008 D4)
}

export const DEFAULT_CONFIG: GardenConfig = {
  ring: 96,
  wheels: [52],
  offset: 0.66,
  speed: 58,
  showPreview: true,
  clearingRake: false,
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
