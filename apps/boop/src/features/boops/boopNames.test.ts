import { describe, expect, it } from 'vitest'

import { generateBoopName } from './boopNames.ts'

describe('generateBoopName', () => {
  it('names the first saved boop "Boop 1"', () => {
    expect(generateBoopName([])).toBe('Boop 1')
  })

  it('counts past the existing boops', () => {
    expect(generateBoopName(['Boop 1', 'Boop 2'])).toBe('Boop 3')
  })

  it('fills a gap below the highest existing number', () => {
    expect(generateBoopName(['Boop 1', 'Boop 3'])).toBe('Boop 2')
  })

  it('does not count a renamed boop towards the next number', () => {
    expect(generateBoopName(['Boop 1', 'My Beat'])).toBe('Boop 2')
  })

  // ADR 0025/ticket 35: pre-rename "Groove N" rows are left exactly as they
  // are on disk and must be non-candidates for the new naming — an old
  // "Groove 2" neither blocks nor is confused with a new "Boop 2".
  it('treats old "Groove N" rows as non-candidates, mixed in with new ones', () => {
    expect(generateBoopName(['Groove 1', 'Groove 2', 'Boop 1'])).toBe('Boop 2')
  })
})
