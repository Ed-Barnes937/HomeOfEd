import { describe, expect, it } from 'vitest'

import { generateGrooveName } from './grooveNames.ts'

describe('generateGrooveName', () => {
  it('names the first saved groove "Groove 1"', () => {
    expect(generateGrooveName([])).toBe('Groove 1')
  })

  it('counts past the existing grooves', () => {
    expect(generateGrooveName(['Groove 1', 'Groove 2'])).toBe('Groove 3')
  })

  it('still counts a renamed groove towards the next number', () => {
    expect(generateGrooveName(['Groove 1', 'My Beat'])).toBe('Groove 3')
  })

  it('picks the next free number when the straightforward guess collides', () => {
    // Two existing names, but "Groove 3" (existingNames.length + 1) is already
    // taken by an earlier rename — the next free number must still be unique.
    expect(generateGrooveName(['Groove 3', 'Groove 4'])).toBe('Groove 5')
  })
})
