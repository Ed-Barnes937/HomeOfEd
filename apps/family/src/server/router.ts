import { createTRPC } from '@hoe/backend-kit'

import { GreetingHandler } from './handlers/greetingHandler.ts'

// `void` until ticket 03 introduces FamilyStore.
const t = createTRPC<void>()

export const appRouter = t.router({
  greeting: t.procedure.query(({ ctx }) => new GreetingHandler().run(undefined, ctx)),
})

/** Exported for the client and all transports. */
export type AppRouter = typeof appRouter
