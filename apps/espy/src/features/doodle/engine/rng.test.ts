import { describe, expect, it } from 'vitest'

import { mulberry32 } from './rng.ts'

function sample(seed: number, n: number): number[] {
  const rng = mulberry32(seed)
  return Array.from({ length: n }, () => rng())
}

describe('mulberry32', () => {
  it('is deterministic — the same seed yields the same sequence', () => {
    expect(sample(12345, 10)).toEqual(sample(12345, 10))
  })

  it('diverges for different seeds', () => {
    expect(sample(1, 10)).not.toEqual(sample(2, 10))
  })

  it('produces every value in [0, 1)', () => {
    const rng = mulberry32(99)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
