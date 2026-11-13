// OKLab and OKLCH conversions and the two colour recipes of a mixed potion.

import { type LinearRgb, linearToSrgb, srgbToLinear } from '../items/colour.ts'
import { INGREDIENTS } from './ingredients.ts'

interface Oklab {
  l: number
  a: number
  b: number
}

export interface Oklch {
  l: number
  c: number
  h: number
}

const WHEEL_STEP = 360 / INGREDIENTS.length
const MURK_BASE = '#5b5533'
const MURK_PULL = 0.15
const MURK_MAX_CHROMA = 0.05
const MURK_LIGHTNESS: [number, number] = [0.38, 0.48]
const EFFECT_MIN_CHROMA = 0.12
const EFFECT_LIGHTNESS: [number, number] = [0.58, 0.78]
const REACH_FLOOR = 0.78
const REACH_CEILING = 3

const clamp = (n: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, n))

function hexToOklab(hex: string): Oklab {
  const [r, g, b] = srgbToLinear(hex)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

function oklabToHex({ l, a, b }: Oklab): string {
  const lc = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mc = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const sc = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb: LinearRgb = [
    4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc,
    -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc,
    -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc,
  ]
  return linearToSrgb(rgb)
}

export function hexToOklch(hex: string): Oklch {
  const { l, a, b } = hexToOklab(hex)
  const h = (Math.atan2(b, a) * 180) / Math.PI
  return { l, c: Math.hypot(a, b), h: (h + 360) % 360 }
}

export function oklchToHex(l: number, c: number, h: number): string {
  const rad = (h * Math.PI) / 180
  return oklabToHex({ l, a: c * Math.cos(rad), b: c * Math.sin(rad) })
}

/** The shorter way round the hue circle from `from` to `to`, as a signed step. */
const hueStep = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180

/**
 * The jewel colour at `angle` on the wheel: the two ingredient colours either side of it blended in
 * OKLCH, chroma scaled by how far the sum reached, then lifted into a jewel range.
 */
export function effectColour(angle: number, reach: number): string {
  const lower = Math.floor(angle / WHEEL_STEP) % INGREDIENTS.length
  const upper = (lower + 1) % INGREDIENTS.length
  const t = (angle - lower * WHEEL_STEP) / WHEEL_STEP
  const from = hexToOklch(INGREDIENTS[lower]!.colour)
  const to = hexToOklch(INGREDIENTS[upper]!.colour)
  const strength = Math.min(1, Math.max(0, (reach - REACH_FLOOR) / (REACH_CEILING - REACH_FLOOR)))
  const chroma = (from.c + (to.c - from.c) * t) * (0.75 + 0.25 * strength)
  return oklchToHex(
    clamp(from.l + (to.l - from.l) * t, EFFECT_LIGHTNESS),
    Math.max(chroma, EFFECT_MIN_CHROMA),
    from.h + hueStep(from.h, to.h) * t,
  )
}

/** A designed mud, nudged towards the mean of the three ingredient colours. */
export function murkyColour(colours: readonly string[]): string {
  const labs = colours.map(hexToOklab)
  const mean = (pick: (lab: Oklab) => number) =>
    labs.reduce((sum, lab) => sum + pick(lab), 0) / labs.length
  const base = hexToOklab(MURK_BASE)
  const pulled: Oklab = {
    l: base.l + (mean((x) => x.l) - base.l) * MURK_PULL,
    a: base.a + (mean((x) => x.a) - base.a) * MURK_PULL,
    b: base.b + (mean((x) => x.b) - base.b) * MURK_PULL,
  }
  const chroma = Math.min(Math.hypot(pulled.a, pulled.b), MURK_MAX_CHROMA)
  const hue = Math.atan2(pulled.b, pulled.a)
  return oklabToHex({
    l: clamp(pulled.l, MURK_LIGHTNESS),
    a: chroma * Math.cos(hue),
    b: chroma * Math.sin(hue),
  })
}
