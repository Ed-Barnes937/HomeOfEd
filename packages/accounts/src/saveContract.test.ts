import { describe, expect, it } from 'vitest'

import { saveGetInput, savePutInput } from './saveContract.ts'

describe('the save contract', () => {
  it('names no account: the service derives it from the token', () => {
    const parsed = savePutInput.parse({
      appId: 'boop',
      slotKey: 'boop:save',
      blob: '{}',
      accountId: 'someone-else',
    })

    expect(parsed).not.toHaveProperty('accountId')
  })

  // slotKey is stored, counted and part of a btree primary key, so an
  // unbounded one is storage the byte quota never sees.
  it('bounds slotKey, and still accepts a key at the bound', () => {
    expect(saveGetInput.safeParse({ appId: 'boop', slotKey: 'k'.repeat(128) }).success).toBe(true)
    expect(saveGetInput.safeParse({ appId: 'boop', slotKey: 'k'.repeat(129) }).success).toBe(false)
  })

  it('refuses an empty appId or slotKey', () => {
    expect(saveGetInput.safeParse({ appId: '', slotKey: 'boop:save' }).success).toBe(false)
    expect(saveGetInput.safeParse({ appId: 'boop', slotKey: '' }).success).toBe(false)
  })
})
