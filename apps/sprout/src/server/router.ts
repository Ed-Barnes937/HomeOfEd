import { createTRPC } from '@hoe/backend-kit'

import { GreetingHandler } from './handlers/greetingHandler.ts'
import type { SproutStore } from './store.ts'

// The Store type parameter is `SproutStore` (plan §6/§11 P1): the merged schema
// is injected per transport (PGlite in simulator.ts/.iwft, real Postgres in
// main.ts). The greeting demo is P0 scaffolding P3 replaces; it ignores the
// store but shares the context type.
const t = createTRPC<SproutStore>()

export const appRouter = t.router({
  greeting: t.procedure.query(({ ctx }) => new GreetingHandler().run(undefined, ctx)),
})

/** Exported for the client and all transports. */
export type AppRouter = typeof appRouter
