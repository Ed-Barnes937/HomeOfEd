import { ConsoleLogger, InMemoryBlobStore, type AppContext, type AuthProvider } from '@hoe/backend-kit'
import { describe, expect, it } from 'vitest'

import { HealthHandler } from './handlers/healthHandler.ts'

// No Store (ADR 0008): the context still carries the frozen seams; this
// exercises the auth seam even though the handler ignores it. store is `void`.
function makeCtx(auth: AuthProvider): AppContext<void> {
  return {
    store: undefined,
    blobs: new InMemoryBlobStore(),
    auth,
    now: () => new Date('2026-01-01T00:00:00Z'),
    logger: new ConsoleLogger(),
  }
}

describe('HealthHandler', () => {
  it('returns ok with no user', async () => {
    const ctx = makeCtx({ getUser: () => null })
    await expect(new HealthHandler().run(undefined, ctx)).resolves.toEqual({ ok: true })
  })

  it('returns ok for an authed user too', async () => {
    const ctx = makeCtx({ getUser: () => ({ id: 'ada' }) })
    await expect(new HealthHandler().run(undefined, ctx)).resolves.toEqual({ ok: true })
  })
})
