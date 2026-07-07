import { describe, expect, it } from 'vitest'

import { canonicaliseForScan } from './canonicalise.ts'

// Zero-width space, used to split words in the obfuscation tests.
const ZW = '\u200B'
const SOFT_HYPHEN = '\u00AD'
const WORD_JOINER = '\u2060'

describe('canonicaliseForScan', () => {
  describe('homoglyph folding', () => {
    it('folds Cyrillic look-alikes back to ASCII', () => {
      expect(canonicaliseForScan('bоmb')).toBe('bomb') // Cyrillic о
      // Cyrillic к folds to an uppercase K; the keyword matchers are
      // case-insensitive, so detection is unaffected.
      expect(canonicaliseForScan('кill')).toBe('Kill') // Cyrillic к
    })
  })

  describe('zero-width stripping', () => {
    it('removes zero-width characters that split words', () => {
      expect(canonicaliseForScan(`sh${ZW}it`)).toBe('shit')
      expect(canonicaliseForScan(`b${ZW}o${ZW}mb`)).toBe('bomb')
    })

    it('removes a soft hyphen and word joiner', () => {
      expect(canonicaliseForScan(`bo${SOFT_HYPHEN}m${WORD_JOINER}b`)).toBe('bomb')
    })
  })

  describe('emoji substitution', () => {
    it('maps safety-relevant emoji to the word they stand in for', () => {
      expect(canonicaliseForScan('make a 💣')).toBe('make a bomb')
      expect(canonicaliseForScan('a 🔪')).toBe('a knife')
    })
  })

  describe('de-leeting', () => {
    it('undoes classic leetspeak substitutions adjacent to letters', () => {
      expect(canonicaliseForScan('b0mb')).toBe('bomb')
      expect(canonicaliseForScan('k!ll')).toBe('kill')
    })

    it('leaves standalone numbers and prices intact', () => {
      expect(canonicaliseForScan('I scored 100 in maths')).toBe('I scored 100 in maths')
      expect(canonicaliseForScan('$5 each')).toBe('$5 each')
    })
  })

  describe('NFKC normalisation', () => {
    it('normalises full-width letters', () => {
      expect(canonicaliseForScan('ｂｏｍｂ')).toBe('bomb')
    })
  })

  describe('non-mutation contract', () => {
    it('returns a copy and never changes the caller original string', () => {
      const original = `sh${ZW}it`
      const copy = canonicaliseForScan(original)
      expect(copy).not.toBe(original)
      // Strings are immutable in JS; assert the original is byte-for-byte intact.
      expect(original).toBe(`sh${ZW}it`)
      expect(original).toHaveLength(5)
    })

    it('leaves clean text semantically intact (whitespace collapsed only)', () => {
      expect(canonicaliseForScan('The sun is a big star.')).toBe('The sun is a big star.')
    })
  })

  describe('performance', () => {
    it('canonicalises a typical message in well under 1ms', () => {
      const message =
        'Can you explain how rainbows work? I saw one after it rained yesterday and it was really pretty.'
      const iterations = 1000
      const start = performance.now()
      for (let i = 0; i < iterations; i++) canonicaliseForScan(message)
      const perCall = (performance.now() - start) / iterations
      expect(perCall).toBeLessThan(1)
    })
  })
})
