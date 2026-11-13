import { describe, expect, it } from 'vitest'

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
})
