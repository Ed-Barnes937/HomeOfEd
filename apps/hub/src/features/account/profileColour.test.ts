import { describe, expect, it } from 'vitest'

import { PROFILE_COLOURS, profileColour } from './profileColour.ts'

describe('profileColour', () => {
  it('is the same for the same id, every time', () => {
    expect(profileColour('child-7f3a')).toBe(profileColour('child-7f3a'))
  })

  it('is always one of the palette slots', () => {
    for (const id of ['', 'parent-ada', 'child-1', 'c4e1f0a2-9b7d-4f1e-8a3c-2d6b5e9f0a11']) {
      const slot = profileColour(id)
      expect(Number.isInteger(slot)).toBe(true)
      expect(slot).toBeGreaterThanOrEqual(0)
      expect(slot).toBeLessThan(PROFILE_COLOURS)
    }
  })

  it('spreads a household of ids across the palette', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `child-${i}`)
    expect(new Set(ids.map(profileColour)).size).toBe(PROFILE_COLOURS)
  })
})
