import { describe, expect, it } from 'vitest'

import { blobCount, blobRadiusFraction, MIN_BLOBS } from './layout.ts'

describe('blobCount', () => {
  it('floors small canvases to MIN_BLOBS (3)', () => {
    expect(MIN_BLOBS).toBe(3)
    expect(blobCount(10, 10)).toBe(MIN_BLOBS)
    // Phones sit under the 190k density's 3-mark point, so they all floor to 3.
    expect(blobCount(360, 780)).toBe(3) // small phone
    expect(blobCount(390, 844)).toBe(3) // iPhone 14
    expect(blobCount(430, 932)).toBe(3) // Pro Max
  })

  it('clamps a huge area to 8', () => {
    expect(blobCount(5000, 5000)).toBe(8)
    expect(blobCount(3440, 1440)).toBe(8) // ultrawide
  })

  it('scales continuously with area above the floor (tablet/desktop unchanged)', () => {
    expect(blobCount(720, 850)).toBe(3) // tablet ~3
    expect(blobCount(1550, 760)).toBe(6) // desktop ~6
  })

  it('rounds area / 190_000 above the floor', () => {
    // 760_000 -> 4 ; 1_140_000 -> 6
    expect(blobCount(950, 800)).toBe(4)
    expect(blobCount(1140, 1000)).toBe(6)
  })
})

describe('blobRadiusFraction', () => {
  it('is 0.26 at count 1 and 0.12 at count 8', () => {
    expect(blobRadiusFraction(1)).toBeCloseTo(0.26)
    expect(blobRadiusFraction(8)).toBeCloseTo(0.12)
  })

  it('decreases monotonically over the count range', () => {
    for (let c = 2; c <= 8; c++) {
      expect(blobRadiusFraction(c)).toBeLessThan(blobRadiusFraction(c - 1))
    }
  })

  it('clamps to [0.10, 0.26]', () => {
    expect(blobRadiusFraction(0)).toBeCloseTo(0.26) // would be 0.28
    expect(blobRadiusFraction(20)).toBeCloseTo(0.1) // would be negative
  })
})
