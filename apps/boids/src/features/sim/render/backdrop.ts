export interface Star {
  x: number
  y: number
  /** Dot radius in CSS px. */
  r: number
  /** Alpha 0–1; the faint ones read as distant stars. */
  a: number
}

/** Deterministic PRNG (mulberry32) so a given viewport yields a stable starfield. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A subtle static starfield: ~one star per 8000 px² of viewport, with
 * positions, size, and alpha fixed per seed so the field never twinkles or
 * jumps between frames. Pure — the renderer paints these onto a cached canvas.
 */
export function generateStars(width: number, height: number, seed = 1): Star[] {
  const count = Math.max(0, Math.round((width * height) / 8000))
  const rnd = mulberry32(seed)
  const stars: Star[] = []
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rnd() * width,
      y: rnd() * height,
      r: 0.4 + rnd() * 1.1,
      a: 0.2 + rnd() * 0.55,
    })
  }
  return stars
}
