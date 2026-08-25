import { describe, expect, it } from 'vitest'

import { initialTheme, THEME_STORAGE_KEY } from './theme.ts'

/** Minimal Storage stand-in — only what initialTheme reads. */
function storageWith(entries: Record<string, string>): Pick<Storage, 'getItem'> {
  return { getItem: (key) => entries[key] ?? null }
}

describe('initialTheme', () => {
  it('returns the stored choice when one exists', () => {
    const storage = storageWith({ [THEME_STORAGE_KEY]: 'dark' })
    expect(initialTheme(storage, false)).toBe('dark')
    expect(initialTheme(storage, true)).toBe('dark')
  })

  it('falls back to the system preference when nothing is stored', () => {
    const storage = storageWith({})
    expect(initialTheme(storage, true)).toBe('dark')
    expect(initialTheme(storage, false)).toBe('light')
  })

  it('ignores a garbage stored value and uses the system preference', () => {
    const storage = storageWith({ [THEME_STORAGE_KEY]: 'sepia' })
    expect(initialTheme(storage, true)).toBe('dark')
  })
})
