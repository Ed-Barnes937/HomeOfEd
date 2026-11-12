import { describe, expect, it } from 'vitest'

import { LAST_SHOP_KEY, readLastShop, writeLastShop } from './lastShop.ts'
import { FakeStorage } from './testing/fakeStorage.ts'

describe('the last shop', () => {
  it('is none until a shop is visited', () => {
    expect(readLastShop(new FakeStorage())).toBeNull()
  })

  it.each(['wand', 'sword'] as const)('remembers the %s shop', (kind) => {
    const storage = new FakeStorage()
    writeLastShop(storage, kind)
    expect(readLastShop(storage)).toBe(kind)
  })

  it('is stored as the bare kind under its own key', () => {
    const storage = new FakeStorage()
    writeLastShop(storage, 'sword')
    expect(LAST_SHOP_KEY).toBe('armoury:shop')
    expect([...storage.store.entries()]).toEqual([['armoury:shop', 'sword']])
  })

  it.each(['', 'axe', 'Wand', '"wand"', '{"kind":"wand"}'])('reads %j as none', (stored) => {
    const storage = new FakeStorage()
    storage.store.set(LAST_SHOP_KEY, stored)
    expect(readLastShop(storage)).toBeNull()
  })

  it('never throws when storage is unavailable', () => {
    const storage = new FakeStorage()
    storage.unavailable = true
    expect(() => writeLastShop(storage, 'wand')).not.toThrow()
    expect(readLastShop(storage)).toBeNull()
  })
})
