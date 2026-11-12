// Colour helpers and the gem colours every item kind shares.

export type LinearRgb = [number, number, number]

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

export function srgbToLinear(hex: string): LinearRgb {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)]
}

export function linearToSrgb([r, g, b]: LinearRgb): string {
  const c = (v: number) => {
    const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
    return Math.round(clamp01(s) * 255)
  }
  return `#${((c(r) << 16) | (c(g) << 8) | c(b)).toString(16).padStart(6, '0')}`
}

/** The stone is its glow's colour at a quarter of the light, unless it says otherwise. */
export const GEM_COLOURS: Record<string, { glow: string; body?: string }> = {
  amethyst: { glow: '#c38bff' },
  emerald: { glow: '#4dff98' },
  ruby: { glow: '#ff2440' },
  sapphire: { glow: '#5a86ff' },
  citrine: { glow: '#ff901f' },
  // Colourless quartz lit from inside: a cool white light in a grey stone.
  clear: { glow: '#eaf2ff', body: '#4a5058' },
  // Light through smoked glass: dim and warm, in a near-black stone.
  smoky: { glow: '#a8703f', body: '#1c1612' },
}

/** A named gem's light and stone as sRGB hex, or `fallbackGlow` (a "match" option) when unnamed. */
export function gemLight(gemColour: string, fallbackGlow: string): { glow: string; body: string } {
  const named = GEM_COLOURS[gemColour]
  const glow = named?.glow ?? fallbackGlow
  const body = named?.body ?? linearToSrgb(srgbToLinear(glow).map((v) => v * 0.25) as LinearRgb)
  return { glow, body }
}
