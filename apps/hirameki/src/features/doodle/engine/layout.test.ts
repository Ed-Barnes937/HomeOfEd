import { describe, expect, it } from 'vitest'

import { blobCount, blobRadiusFraction } from './layout.ts'

describe('blobCount', () => {
  it('clamps a tiny area to 1', () => {
    expect(blobCount(10, 10)).toBe(1)
    expect(blobCount(360, 520)).toBe(1) // phone
  })

  it('clamps a huge area to 9', () => {
    expect(blobCount(5000, 5000)).toBe(9)
    expect(blobCount(3440, 1440)).toBe(9) // ultrawide
  })

  it('scales continuously with area for mid sizes', () => {
    expect(blobCount(720, 850)).toBe(4) // tablet ~4
    expect(blobCount(1550, 760)).toBe(8) // desktop ~8
  })

  it('rounds area / 150_000', () => {
    // 150_000 css-px² -> 1 ; 600_000 -> 4
    expect(blobCount(500, 300)).toBe(1)
    expect(blobCount(800, 750)).toBe(4)
  })
})

describe('blobRadiusFraction', () => {
  it('is 0.26 at count 1 and 0.10 at count 9', () => {
    expect(blobRadiusFraction(1)).toBeCloseTo(0.26)
    expect(blobRadiusFraction(9)).toBeCloseTo(0.1)
  })

  it('decreases monotonically over the count range', () => {
    for (let c = 2; c <= 9; c++) {
      expect(blobRadiusFraction(c)).toBeLessThan(blobRadiusFraction(c - 1))
    }
  })

  it('clamps to [0.10, 0.26]', () => {
    expect(blobRadiusFraction(0)).toBeCloseTo(0.26) // would be 0.28
    expect(blobRadiusFraction(20)).toBeCloseTo(0.1) // would be negative
  })
})
