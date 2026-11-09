import { describe, expect, it } from 'vitest'

import { SAVE_KEY } from '../persistence/storage.ts'
import { FakeStorage } from '../persistence/testing/fakeStorage.ts'
import { hasSyncedAccount, stampSyncedAccount, SYNCED_ACCOUNT_KEY } from './syncedAccount.ts'

describe('the synced-account marker', () => {
  it('is absent until the account is stamped', () => {
    const storage = new FakeStorage()

    expect(hasSyncedAccount(storage, 'child-1')).toBe(false)
    stampSyncedAccount(storage, 'child-1')
    expect(hasSyncedAccount(storage, 'child-1')).toBe(true)
  })

  it('is per account, so a second child on the same tablet is a first link of their own', () => {
    const storage = new FakeStorage()
    stampSyncedAccount(storage, 'child-1')

    expect(hasSyncedAccount(storage, 'child-2')).toBe(false)

    stampSyncedAccount(storage, 'child-2')

    expect(hasSyncedAccount(storage, 'child-1')).toBe(true)
    expect(hasSyncedAccount(storage, 'child-2')).toBe(true)
  })

  it('stamping twice does not grow the marker', () => {
    const storage = new FakeStorage()
    stampSyncedAccount(storage, 'child-1')
    stampSyncedAccount(storage, 'child-1')

    expect(storage.store.get(SYNCED_ACCOUNT_KEY)).toBe('["child-1"]')
  })

  it('never touches the save document', () => {
    const storage = new FakeStorage()
    storage.setItem(SAVE_KEY, 'the boops')

    stampSyncedAccount(storage, 'child-1')

    expect(storage.store.get(SAVE_KEY)).toBe('the boops')
  })

  it('reads a corrupt marker as "not offered yet" rather than throwing', () => {
    const storage = new FakeStorage()
    storage.setItem(SYNCED_ACCOUNT_KEY, '{not json')

    expect(hasSyncedAccount(storage, 'child-1')).toBe(false)
  })

  it('survives a browser with storage switched off', () => {
    const storage = new FakeStorage()
    storage.unavailable = true

    expect(hasSyncedAccount(storage, 'child-1')).toBe(false)
    expect(() => stampSyncedAccount(storage, 'child-1')).not.toThrow()
  })
})
