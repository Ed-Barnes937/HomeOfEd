import { createTRPC } from '@hoe/backend-kit'

import { GreetingHandler } from './handlers/greetingHandler.ts'

// No Store: this app persists nothing (ADR 0007), so the Store type parameter
// is `void`. Adding a database later = swap `void` for your Store interface and
// inject it in simulator.ts / main.ts.
const t = createTRPC<void>()

export const appRouter = t.router({
  greeting: t.procedure.query(({ ctx }) => new GreetingHandler().run(undefined, ctx)),
})

/** Exported for the client and all transports. */
export type AppRouter = typeof appRouter
