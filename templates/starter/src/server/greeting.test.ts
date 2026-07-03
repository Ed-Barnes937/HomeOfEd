import {
  ConsoleLogger,
  InMemoryBlobStore,
  type AppContext,
  type AuthProvider,
} from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { GreetingHandler } from './handlers/greetingHandler.ts'

// No Store (ADR 0007): the context still carries the frozen seams; this
// exercises the auth seam the handler reads. store is `void`.
function makeCtx(auth: AuthProvider): AppContext<void> {
  return {
    store: undefined,
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
      value: 'hello from the starter',
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
