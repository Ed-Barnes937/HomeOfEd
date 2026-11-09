import { describe, expect, it } from 'vitest'

import { SAVE_KEY } from '../persistence/storage.ts'
import { FakeStorage } from '../persistence/testing/fakeStorage.ts'
import { readSyncAnswer, recordSyncAnswer, SYNCED_ACCOUNT_KEY } from './syncedAccount.ts'

describe('the synced-account marker', () => {
  it('is null until the account has been answered for', () => {
    const storage = new FakeStorage()

    expect(readSyncAnswer(storage, 'child-1')).toBeNull()
    recordSyncAnswer(storage, 'child-1', 'accepted')
    expect(readSyncAnswer(storage, 'child-1')).toBe('accepted')
  })

  it('remembers which answer was given, not merely that one was', () => {
    const storage = new FakeStorage()
    recordSyncAnswer(storage, 'child-1', 'declined')

    expect(readSyncAnswer(storage, 'child-1')).toBe('declined')
  })

  it('is per account, so a second child on the same tablet answers for themselves', () => {
    const storage = new FakeStorage()
    recordSyncAnswer(storage, 'child-1', 'declined')

    expect(readSyncAnswer(storage, 'child-2')).toBeNull()

    recordSyncAnswer(storage, 'child-2', 'accepted')

    expect(readSyncAnswer(storage, 'child-1')).toBe('declined')
    expect(readSyncAnswer(storage, 'child-2')).toBe('accepted')
  })

  it('can change an answer, so a way back needs a write rather than a migration', () => {
    const storage = new FakeStorage()
    recordSyncAnswer(storage, 'child-1', 'declined')
    recordSyncAnswer(storage, 'child-1', 'accepted')

    expect(readSyncAnswer(storage, 'child-1')).toBe('accepted')
    expect(storage.store.get(SYNCED_ACCOUNT_KEY)).toBe('{"child-1":"accepted"}')
  })

  it('reads the marker’s first, list shape as accepted - only accepting could have written it', () => {
    const storage = new FakeStorage()
    storage.setItem(SYNCED_ACCOUNT_KEY, '["child-1","child-2"]')

    expect(readSyncAnswer(storage, 'child-1')).toBe('accepted')
    expect(readSyncAnswer(storage, 'child-2')).toBe('accepted')
    expect(readSyncAnswer(storage, 'child-3')).toBeNull()
  })

  it('keeps the other accounts when it rewrites a legacy marker', () => {
    const storage = new FakeStorage()
    storage.setItem(SYNCED_ACCOUNT_KEY, '["child-1"]')

    recordSyncAnswer(storage, 'child-2', 'declined')

    expect(readSyncAnswer(storage, 'child-1')).toBe('accepted')
    expect(readSyncAnswer(storage, 'child-2')).toBe('declined')
  })

  it('never touches the save document', () => {
    const storage = new FakeStorage()
    storage.setItem(SAVE_KEY, 'the boops')

    recordSyncAnswer(storage, 'child-1', 'accepted')

    expect(storage.store.get(SAVE_KEY)).toBe('the boops')
  })

  it('reads a corrupt marker, or an answer it does not know, as "not asked yet"', () => {
    const storage = new FakeStorage()
    storage.setItem(SYNCED_ACCOUNT_KEY, '{not json')
    expect(readSyncAnswer(storage, 'child-1')).toBeNull()

    storage.setItem(SYNCED_ACCOUNT_KEY, '{"child-1":"maybe"}')
    expect(readSyncAnswer(storage, 'child-1')).toBeNull()
  })

  it('survives a browser with storage switched off', () => {
    const storage = new FakeStorage()
    storage.unavailable = true

    expect(readSyncAnswer(storage, 'child-1')).toBeNull()
    expect(() => recordSyncAnswer(storage, 'child-1', 'accepted')).not.toThrow()
  })
})
