import { ConsoleLogger, InMemoryBlobStore, NotFoundError, type AppContext } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import type { StoredBoard } from '../boardSchema.ts'
import type { FridgeStore } from '../store.ts'
import { GetBoardHandler, getBoardInputSchema } from './getBoardHandler.ts'

class FakeFridgeStore implements FridgeStore {
  private readonly rows = new Map<string, { name: string; payload: StoredBoard }>()

  seed(id: string, name: string, payload: StoredBoard): void {
    this.rows.set(id, { name, payload })
  }

  ping(): Promise<{ ok: true }> {
    return Promise.resolve({ ok: true })
  }

  insertSharedBoard(id: string, name: string, payload: StoredBoard): Promise<void> {
    this.rows.set(id, { name, payload })
    return Promise.resolve()
  }

  getSharedBoard(id: string): Promise<{ name: string; payload: StoredBoard } | null> {
    return Promise.resolve(this.rows.get(id) ?? null)
  }
}

function makeCtx(store: FridgeStore): AppContext<FridgeStore> {
  return {
    store,
    blobs: new InMemoryBlobStore(),
    auth: { getUser: () => null },
    now: () => new Date('2026-01-01T00:00:00Z'),
    logger: new ConsoleLogger(),
  }
}

const board = (name: string): StoredBoard => ({
  name,
  finish: 'red',
  wall: 'cool',
  magnets: [{ type: 'number', label: '3', deg: 0, color: 'green', x: 10, y: 20, rot: 0 }],
})

describe('GetBoardHandler', () => {
  it('returns the stored board', async () => {
    const store = new FakeFridgeStore()
    store.seed('abcABC1234', 'HELLO', board('HELLO'))

    await expect(
      new GetBoardHandler().run({ id: 'abcABC1234' }, makeCtx(store)),
    ).resolves.toEqual(board('HELLO'))
  })

  it('throws NotFoundError for an unknown id', async () => {
    const store = new FakeFridgeStore()

    await expect(
      new GetBoardHandler().run({ id: 'missing000' }, makeCtx(store)),
    ).rejects.toThrow(NotFoundError)
  })

  it('re-validates the payload on the way out and rejects a row that went bad', async () => {
    const store = new FakeFridgeStore()
    // Simulate a corrupted row: label violates storedBoardSchema's regex.
    const bad = { ...board('bad'), magnets: [{ ...board('bad').magnets[0]!, label: 'XX' }] }
    store.seed('badBoard01', 'bad', bad)

    await expect(new GetBoardHandler().run({ id: 'badBoard01' }, makeCtx(store))).rejects.toThrow()
  })
})

describe('getBoardInputSchema', () => {
  it('accepts a valid 10-char alphanumeric id', () => {
    expect(getBoardInputSchema.safeParse({ id: 'abcABC1234' }).success).toBe(true)
  })

  it('rejects the wrong length', () => {
    expect(getBoardInputSchema.safeParse({ id: 'short' }).success).toBe(false)
  })

  it('rejects non-alphanumeric characters', () => {
    expect(getBoardInputSchema.safeParse({ id: 'abcABC123!' }).success).toBe(false)
  })
})
