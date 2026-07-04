import { ConflictError, ConsoleLogger, InMemoryBlobStore, type AppContext } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import type { StoredBoard } from '../boardSchema.ts'
import type { FridgeStore } from '../store.ts'
import { ShareBoardHandler } from './shareBoardHandler.ts'

// Unit seam: a hand-written, stateful Store fake — the handler never sees a
// database. Mirrors insertSharedBoard's documented contract: throws on a
// primary-key (id) conflict.
class FakeFridgeStore implements FridgeStore {
  private readonly rows = new Map<string, { name: string; payload: StoredBoard }>()

  ping(): Promise<{ ok: true }> {
    return Promise.resolve({ ok: true })
  }

  insertSharedBoard(id: string, name: string, payload: StoredBoard): Promise<void> {
    if (this.rows.has(id)) return Promise.reject(new Error('duplicate id'))
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
  finish: 'mint',
  wall: 'warm',
  magnets: [{ type: 'letter', label: 'A', deg: 0, color: 'red', x: 100, y: 40, rot: 0 }],
})

/** A stub idGen that returns each id in `ids` in order, once per call. */
function queuedIdGen(ids: string[]): () => string {
  let i = 0
  return () => ids[i++]!
}

describe('ShareBoardHandler', () => {
  it('inserts under the generated id and returns it', async () => {
    const store = new FakeFridgeStore()
    const handler = new ShareBoardHandler(queuedIdGen(['abcABC1234']))

    await expect(handler.run(board('HELLO'), makeCtx(store))).resolves.toEqual({
      id: 'abcABC1234',
    })
    await expect(store.getSharedBoard('abcABC1234')).resolves.toEqual({
      name: 'HELLO',
      payload: board('HELLO'),
    })
  })

  it('retries with a fresh id when the first one collides', async () => {
    const store = new FakeFridgeStore()
    await store.insertSharedBoard('dupe000001', 'taken', board('taken'))
    const handler = new ShareBoardHandler(queuedIdGen(['dupe000001', 'freshId001']))

    await expect(handler.run(board('mine'), makeCtx(store))).resolves.toEqual({
      id: 'freshId001',
    })
  })

  it('gives up after exhausting retries and throws a ConflictError', async () => {
    const store = new FakeFridgeStore()
    await store.insertSharedBoard('alwaysDupe', 'taken', board('taken'))
    const handler = new ShareBoardHandler(queuedIdGen(['alwaysDupe', 'alwaysDupe', 'alwaysDupe']))

    await expect(handler.run(board('mine'), makeCtx(store))).rejects.toThrow(ConflictError)
  })
})
