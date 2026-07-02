import { createTRPC } from '@hoe/backend-kit'

import { HealthHandler } from './handlers/healthHandler.ts'
import type { HealthStore } from './store.ts'

const t = createTRPC<HealthStore>()

export const appRouter = t.router({
  health: t.procedure.query(({ ctx }) => new HealthHandler().run(undefined, ctx)),
})

/** Exported for the client and all three transports. */
export type AppRouter = typeof appRouter
