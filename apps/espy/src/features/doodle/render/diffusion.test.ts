import { describe, expect, it } from 'vitest'

import { blotProgress, easeOutCubic, growScale, layerAlpha } from './diffusion.ts'

describe('easeOutCubic', () => {
  it('clamps to 0 at/below 0 and 1 at/above 1', () => {
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(2)).toBe(1)
  })

  it('is eased-out: past the linear midpoint at t=0.5', () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5)
  })
})

describe('blotProgress', () => {
  it('tracks the global phase directly for a single blot', () => {
    expect(blotProgress(0, 0, 1)).toBe(0)
    expect(blotProgress(0.5, 0, 1)).toBe(0.5)
    expect(blotProgress(1, 0, 1)).toBe(1)
  })

  it('has every blot settled once the global phase reaches 1', () => {
    const count = 6
    for (let i = 0; i < count; i++) expect(blotProgress(1, i, count)).toBe(1)
  })

  it('leads with earlier blots — index 0 is ahead of the last', () => {
    const count = 6
    const first = blotProgress(0.5, 0, count)
    const last = blotProgress(0.5, count - 1, count)
    expect(first).toBeGreaterThan(last)
  })

  it('clamps into [0, 1]', () => {
    expect(blotProgress(-1, 0, 4)).toBe(0)
    expect(blotProgress(2, 3, 4)).toBe(1)
  })
})

describe('growScale', () => {
  it('starts at a small seed and reaches full size', () => {
    expect(growScale(0)).toBeGreaterThan(0)
    expect(growScale(0)).toBeLessThan(0.3)
    expect(growScale(1)).toBe(1)
  })

  it('is monotonic increasing', () => {
    expect(growScale(0.25)).toBeLessThan(growScale(0.5))
    expect(growScale(0.5)).toBeLessThan(growScale(0.75))
  })
})

describe('layerAlpha', () => {
  it('ramps from transparent to opaque', () => {
    expect(layerAlpha(0)).toBe(0)
    expect(layerAlpha(1)).toBe(1)
  })
})
