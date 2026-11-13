import { describe, expect, it } from 'vitest'

import { PROFILE_COLOURS, profileColour } from './profileColour.ts'

describe('profileColour', () => {
  it('gives each of the first six profiles a colour of its own', () => {
    const firstSix = [0, 1, 2, 3, 4, 5].map(profileColour)
    expect(PROFILE_COLOURS).toHaveLength(6)
    expect(new Set(firstSix).size).toBe(6)
  })

  it('wraps round the palette only past its end', () => {
    expect(profileColour(6)).toBe(profileColour(0))
    expect(profileColour(13)).toBe(profileColour(1))
  })

  it('is always a colour from the palette', () => {
    for (const position of [0, 5, 6, 47]) {
      expect(PROFILE_COLOURS).toContain(profileColour(position))
    }
  })
})
