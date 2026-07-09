/**
 * Gear-train math and palette — ported verbatim from the Studio reference
 * (`Zen Gear Garden Studio.dc.html`). Pure TS: no React, no DOM, no Canvas.
 *
 * `fullTurns` is the least-common-multiple of each wheel's reduced tooth ratio
 * against the ring — the number of carrier revolutions before the pattern
 * closes. `prettyTurns` caps that at a legible 40.
 */

/** Ring (annulus) tooth counts the user can pick from. */
export function ringOpts(): number[] {
  return [96, 120, 144]
}

/** Wheel (planet) tooth counts the user can dock into the train. */
export function wheelOpts(): number[] {
  return [24, 30, 36, 45, 52, 63]
}

/** Maximum wheels in a train. */
export const MAX_GEARS = 3

const PALETTE: Record<number, [string, string]> = {
  24: ['#57c2b8', '#2f877f'],
  30: ['#a7bd72', '#6d8038'],
  36: ['#f0c85a', '#c99a2c'],
  45: ['#f0906d', '#d1553a'],
  52: ['#c88bb0', '#8a5a7a'],
  63: ['#d8a56a', '#9c6b3f'],
}

const PALETTE_FALLBACK: [string, string] = ['#d8a56a', '#9c6b3f']

/** Teeth → `[light, dark]` colour pair; unknown teeth fall back to a neutral tan. */
export function gearPalette(teeth: number): [string, string] {
  return PALETTE[teeth] ?? PALETTE_FALLBACK
}

/** Greatest common divisor (Euclid). */
export function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  return b ? gcd(b, a % b) : a
}

/** Least common multiple. */
export function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b
}

/** Carrier revolutions before the pattern closes; clamped to `[1, 200]`. */
export function fullTurns(ring: number, wheels: number[]): number {
  let l = 1
  for (const w of wheels) {
    const p = w / gcd(ring, w)
    l = lcm(l, p)
  }
  return Math.max(1, Math.min(200, Math.round(l)))
}

/** A legible default cap on rotations — an open, uncluttered pattern. */
export function prettyTurns(ring: number, wheels: number[]): number {
  return Math.max(1, Math.min(fullTurns(ring, wheels), 40))
}

/**
 * Lighten (`amt > 0`) or darken (`amt < 0`) a `#rrggbb` hex by adding `amt` to
 * every channel, clamped to `[0, 255]`. Returns an `rgb(...)` string. Exported
 * for the renderers to reuse.
 */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, Math.min(255, (n >> 16) + amt))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt))
  const b = Math.max(0, Math.min(255, (n & 255) + amt))
  return `rgb(${r},${g},${b})`
}
