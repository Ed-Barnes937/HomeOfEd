import { describe, expect, it } from 'vitest'

import { snapToFlat } from './useDisplay.ts'

describe('snapToFlat', () => {
  it('rolls back to the flat just passed', () => {
    expect(snapToFlat(0.1)).toBeCloseTo(-0.1)
    expect(snapToFlat(0.6)).toBeCloseTo(-0.1)
  })

  it('rolls on to the flat just short of', () => {
    expect(snapToFlat(0.4)).toBeCloseTo(0.1)
    expect(snapToFlat(1.9)).toBeCloseTo(0.1)
  })

  it('works the same rolled the other way', () => {
    expect(snapToFlat(-0.1)).toBeCloseTo(0.1)
    expect(snapToFlat(-0.4)).toBeCloseTo(-0.1)
  })

  it('leaves a roll already on a flat where it is', () => {
    expect(snapToFlat(0)).toBe(0)
    expect(snapToFlat(0.5)).toBe(0)
    expect(snapToFlat(-1.5)).toBe(0)
  })
})
