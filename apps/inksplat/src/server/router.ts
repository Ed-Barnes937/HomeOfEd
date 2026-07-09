import { createTRPC } from '@hoe/backend-kit'

import { HealthHandler } from './handlers/healthHandler.ts'

// No Store: this app persists nothing (ADR 0008), so the Store type parameter
// is `void`. Adding a database later = swap `void` for your Store interface and
// inject it in simulator.ts / main.ts.
const t = createTRPC<void>()

export const appRouter = t.router({
  health: t.procedure.query(({ ctx }) => new HealthHandler().run(undefined, ctx)),
})

/** Exported for all three transports; the frontend makes no tRPC calls (spec §12). */
export type AppRouter = typeof appRouter
