import { describe, expect, it } from 'vitest'

import { boopFilename } from './boopFilename.ts'

describe('boopFilename', () => {
  it('slugs the generated name (ticket 34: "Boop 3" saves as boop-3.wav)', () => {
    expect(boopFilename('Boop 3')).toBe('boop-3.wav')
  })

  it('collapses runs of punctuation and whitespace into single hyphens', () => {
    expect(boopFilename('  My   Best!!! Beat ')).toBe('my-best-beat.wav')
  })

  it('strips path separators a child-typed name could carry', () => {
    expect(boopFilename('a/b\\c')).toBe('a-b-c.wav')
  })

  it('folds accents down to plain letters', () => {
    expect(boopFilename('Café')).toBe('cafe.wav')
  })

  it('falls back to boop.wav when nothing survives slugging', () => {
    expect(boopFilename('🎉🥁')).toBe('boop.wav')
    expect(boopFilename('   ')).toBe('boop.wav')
    expect(boopFilename('')).toBe('boop.wav')
  })
})
