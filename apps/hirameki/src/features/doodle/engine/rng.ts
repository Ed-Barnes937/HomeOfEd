import type { Rng } from './types.ts'

/**
 * Mulberry32 — a small, fast, seedable PRNG. Deterministic: the same seed
 * always yields the same sequence, which makes procedural generation
 * reproducible under test. Outputs are in `[0, 1)`.
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
