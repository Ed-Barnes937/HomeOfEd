import {
  ConsoleLogger,
  InMemoryBlobStore,
  type AppContext,
  type AuthProvider,
} from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import type { StoredBoard } from './boardSchema.ts'
import { HealthHandler } from './handlers/healthHandler.ts'
import type { FridgeStore } from './store.ts'

// Unit seam: a hand-written Store fake, injected. The handler never sees a
// database. share/get are unused by HealthHandler but satisfy the interface.
class FakeFridgeStore implements FridgeStore {
  ping(): Promise<{ ok: true }> {
    return Promise.resolve({ ok: true })
  }
  insertSharedBoard(): Promise<void> {
    return Promise.resolve()
  }
  getSharedBoard(): Promise<{ name: string; payload: StoredBoard } | null> {
    return Promise.resolve(null)
  }
}

function makeCtx(auth: AuthProvider): AppContext<FridgeStore> {
  return {
    store: new FakeFridgeStore(),
    blobs: new InMemoryBlobStore(),
    auth,
    now: () => new Date('2026-01-01T00:00:00Z'),
    logger: new ConsoleLogger(),
  }
}

describe('HealthHandler', () => {
  it('returns ok from the store round-trip', async () => {
    const ctx = makeCtx({ getUser: () => null })
    await expect(new HealthHandler().run(undefined, ctx)).resolves.toEqual({ ok: true })
  })
})
