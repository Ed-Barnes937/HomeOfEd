import { ConsoleLogger, InMemoryBlobStore, type AppContext } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { HealthHandler } from './handlers/healthHandler.ts'
import type { StatusStore } from './store.ts'

// Unit seam: a trivial hand-written Store fake, injected. The handler never
// sees a database.
class FakeStatusStore implements StatusStore {
  ping(): Promise<{ ok: true; value: string }> {
    return Promise.resolve({ ok: true, value: 'from the fake' })
  }
}

function makeCtx(store: StatusStore): AppContext<StatusStore> {
  return {
    store,
    blobs: new InMemoryBlobStore(),
    auth: { getUser: () => null },
    now: () => new Date('2026-01-01T00:00:00Z'),
    logger: new ConsoleLogger(),
  }
}

describe('HealthHandler', () => {
  it('returns ok plus the store-sourced value', async () => {
    const result = await new HealthHandler().run(undefined, makeCtx(new FakeStatusStore()))
    expect(result).toEqual({ ok: true, value: 'from the fake' })
  })
})
