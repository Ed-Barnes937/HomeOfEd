/**
 * mulberry32 — the sim's only source of randomness (spec §5.4). `Math.random()`
 * must not appear anywhere under `src/sim`; element code reaches randomness
 * exclusively through `api.rand()` / `api.randInt()`.
 */
export class Rng {
  #state = 0

  constructor(seed: number) {
    this.reset(seed)
  }

  /** Rewind the stream, so a reset world replays identically. */
  reset(seed: number): void {
    this.#state = seed >>> 0
  }

  /** Uniform float in [0, 1). */
  rand(): number {
    this.#state = (this.#state + 0x6d2b79f5) >>> 0
    let t = this.#state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Uniform integer in [0, maxExclusive). */
  randInt(maxExclusive: number): number {
    return Math.floor(this.rand() * maxExclusive)
  }
}
