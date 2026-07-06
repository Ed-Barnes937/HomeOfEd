import {
  ConsoleLogger,
  InMemoryBlobStore,
  type AppContext,
  type AuthProvider,
} from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { GreetingHandler } from './handlers/greetingHandler.ts'
import type { SproutStore } from './store.ts'

// The greeting demo never touches the store, so an unused stub is fine here —
// this test exercises only the auth seam the handler reads. Real handler tests
// (P3) inject a proper FakeSproutStore.
const unusedStore = {} as unknown as SproutStore

function makeCtx(auth: AuthProvider): AppContext<SproutStore> {
  return {
    store: unusedStore,
    blobs: new InMemoryBlobStore(),
    auth,
    now: () => new Date('2026-01-01T00:00:00Z'),
    logger: new ConsoleLogger(),
  }
}

describe('GreetingHandler', () => {
  it('greets anonymously when there is no user', async () => {
    const ctx = makeCtx({ getUser: () => null })
    await expect(new GreetingHandler().run(undefined, ctx)).resolves.toEqual({
      ok: true,
      value: 'hello from the sprout',
    })
  })

  it('greets the authed user by id', async () => {
    const ctx = makeCtx({ getUser: () => ({ id: 'ada' }) })
    await expect(new GreetingHandler().run(undefined, ctx)).resolves.toEqual({
      ok: true,
      value: 'hello, ada',
    })
  })
})
