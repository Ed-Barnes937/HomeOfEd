import { createTRPC } from '@hoe/backend-kit'

import { GreetingHandler } from './handlers/greetingHandler.ts'
import { GetTodayWordsHandler } from './handlers/todayWordsHandler.ts'
import type { WotdStore } from './store.ts'
import type { WordGenerator } from './wordGenerator.ts'

const t = createTRPC<WotdStore>()

/**
 * Router factory. The Store is injected per transport via the tRPC context; the
 * WordGenerator is injected here — fake in dev/.iwft, Anthropic in prod (the
 * generator seam). Both handlers run unchanged across all transports.
 */
export function createAppRouter(generator: WordGenerator) {
  return t.router({
    // Greeting demo (stateless — handed a store-less context). Removed once the
    // wotd UI covers the app.
    greeting: t.procedure.query(({ ctx }) =>
      new GreetingHandler().run(undefined, { ...ctx, store: undefined }),
    ),
    todayWords: t.procedure.query(({ ctx }) =>
      new GetTodayWordsHandler(generator).run(undefined, ctx),
    ),
  })
}

/** Exported for the client and all transports. */
export type AppRouter = ReturnType<typeof createAppRouter>
