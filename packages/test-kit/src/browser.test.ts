import { afterEach, describe, expect, it, vi } from 'vitest'

import { applyPendingSeed, testUserAuth } from './browser.ts'
import { SEED_SOURCE_KEY, TEST_USER_HEADER, testUserHeaders } from './protocol.ts'

describe('applyPendingSeed', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>)[SEED_SOURCE_KEY]
  })

  it('runs the stashed serialised seed function against the db', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const db = { execute } as never
    ;(globalThis as Record<string, unknown>)[SEED_SOURCE_KEY] =
      `async (db) => { await db.execute("insert into health (value) values ('seeded')") }`

    const returned = await applyPendingSeed(db)

    expect(returned).toBe(db)
    expect(execute).toHaveBeenCalledWith("insert into health (value) values ('seeded')")
  })

  it('is a no-op when no seed is stashed', async () => {
    const db = { execute: vi.fn() } as never
    await expect(applyPendingSeed(db)).resolves.toBe(db)
  })
})

describe('test-user seam', () => {
  it('testUserHeaders emits the well-known header for a user', () => {
    expect(testUserHeaders({ id: 'edd' })).toEqual({ [TEST_USER_HEADER]: 'edd' })
    expect(testUserHeaders(null)).toEqual({})
  })

  it('testUserAuth reads the header back into an AuthProvider', () => {
    const req = new Request('http://test.local', { headers: { [TEST_USER_HEADER]: 'edd' } })
    expect(testUserAuth(req).getUser()).toEqual({ id: 'edd' })
  })

  it('testUserAuth is anonymous without the header', () => {
    expect(testUserAuth(new Request('http://test.local')).getUser()).toBeNull()
  })
})
