import { createTRPC } from '@hoe/backend-kit'

import { HealthHandler } from './handlers/healthHandler.ts'
import type { StatusStore } from './store.ts'

const t = createTRPC<StatusStore>()

export const appRouter = t.router({
  health: t.procedure.query(({ ctx }) => new HealthHandler().run(undefined, ctx)),
})

/** Exported for all three transports; the frontend makes no tRPC calls (ADR 0008). */
export type AppRouter = typeof appRouter
