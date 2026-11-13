import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { profileInitial } from './index.ts'

describe('profileInitial', () => {
  it('is the first letter, upper-cased', () => {
    expect(profileInitial('robin')).toBe('R')
    expect(profileInitial('Ada Lovelace')).toBe('A')
    expect(profileInitial('élodie')).toBe('É')
  })

  it('is empty for a name with nothing to show', () => {
    expect(profileInitial('')).toBe('')
    expect(profileInitial('   ')).toBe('')
    expect(profileInitial('\t\n')).toBe('')
  })

  it('skips leading whitespace', () => {
    expect(profileInitial('  wren')).toBe('W')
  })

  it('keeps a whole emoji, however many code points it is made of', () => {
    expect(profileInitial('🦊 Fox')).toBe('🦊')
    expect(profileInitial('👩‍👧 family')).toBe('👩‍👧')
    expect(profileInitial('👍🏽ok')).toBe('👍🏽')
  })

  it('keeps a letter and its combining mark together', () => {
    expect(profileInitial('émile')).toBe('É')
  })

  describe('in a browser without Intl.Segmenter', () => {
    const segmenter = Object.getOwnPropertyDescriptor(Intl, 'Segmenter')!
    beforeEach(() => {
      Reflect.deleteProperty(Intl, 'Segmenter')
    })
    afterEach(() => {
      Object.defineProperty(Intl, 'Segmenter', segmenter)
    })

    it('loads, and falls back to the first code point', async () => {
      vi.resetModules()
      const { profileInitial: loadedWithout } = await import('./profileInitial.ts')
      expect(loadedWithout('  robin')).toBe('R')
      expect(loadedWithout('🦊 Fox')).toBe('🦊')
      expect(loadedWithout('   ')).toBe('')
    })

    it('falls back too once loaded with it', () => {
      expect(profileInitial('  robin')).toBe('R')
      expect(profileInitial('   ')).toBe('')
    })
  })
})
