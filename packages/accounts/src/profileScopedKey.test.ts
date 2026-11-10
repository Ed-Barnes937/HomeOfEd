import { describe, expect, it } from 'vitest'

import type { KeyValueStorage } from './profileScopedKey.ts'
import { adoptLegacyDocument, profileScopedKey } from './profileScopedKey.ts'

class RecordingStorage implements KeyValueStorage {
  readonly writes: string[] = []
  private readonly items = new Map<string, string>()

  constructor(initial: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(initial)) this.items.set(k, v)
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.writes.push(key)
    this.items.set(key, value)
  }

  removeItem(key: string): void {
    this.writes.push(`remove:${key}`)
    this.items.delete(key)
  }
}

describe('profileScopedKey', () => {
  it('leaves the key alone when nobody is signed in', () => {
    expect(profileScopedKey('boop:save', null)).toBe('boop:save')
  })

  it('suffixes the account id for a signed-in profile', () => {
    expect(profileScopedKey('boop:save', 'child-1')).toBe('boop:save@child-1')
  })
})

describe('adoptLegacyDocument', () => {
  it("copies the device's unscoped document to the profile's key", () => {
    const storage = new RecordingStorage({ 'boop:save': 'legacy' })
    expect(adoptLegacyDocument(storage, 'boop:save', 'child-1')).toBe(true)
    expect(storage.getItem('boop:save@child-1')).toBe('legacy')
  })

  it('never writes or removes the unscoped key', () => {
    const storage = new RecordingStorage({ 'boop:save': 'legacy' })
    adoptLegacyDocument(storage, 'boop:save', 'child-1')
    adoptLegacyDocument(storage, 'boop:save', 'child-2')
    expect(storage.writes).toEqual(['boop:save@child-1', 'boop:save@child-2'])
    expect(storage.getItem('boop:save')).toBe('legacy')
  })

  it('copies into every profile on the device, each from the same legacy document', () => {
    const storage = new RecordingStorage({ 'boop:save': 'legacy' })
    adoptLegacyDocument(storage, 'boop:save', 'child-1')
    storage.setItem('boop:save@child-1', 'child-1 edited')
    adoptLegacyDocument(storage, 'boop:save', 'child-2')
    expect(storage.getItem('boop:save@child-2')).toBe('legacy')
  })

  it("is a no-op once the profile has its own document, so a profile's work is never replaced", () => {
    const storage = new RecordingStorage({ 'boop:save': 'legacy', 'boop:save@child-1': 'mine' })
    expect(adoptLegacyDocument(storage, 'boop:save', 'child-1')).toBe(false)
    expect(storage.getItem('boop:save@child-1')).toBe('mine')
    expect(storage.writes).toEqual([])
  })

  it('treats an empty-string document as existing', () => {
    const storage = new RecordingStorage({ 'boop:save': 'legacy', 'boop:save@child-1': '' })
    expect(adoptLegacyDocument(storage, 'boop:save', 'child-1')).toBe(false)
    expect(storage.writes).toEqual([])
  })

  it('is a no-op when there is no legacy document', () => {
    const storage = new RecordingStorage()
    expect(adoptLegacyDocument(storage, 'boop:save', 'child-1')).toBe(false)
    expect(storage.writes).toEqual([])
  })

  it('is a no-op when nobody is signed in, since the scoped key is the legacy key', () => {
    const storage = new RecordingStorage({ 'boop:save': 'legacy' })
    expect(adoptLegacyDocument(storage, 'boop:save', null)).toBe(false)
    expect(storage.writes).toEqual([])
  })
})
