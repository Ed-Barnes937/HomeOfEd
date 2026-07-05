import { createTRPC } from '@hoe/backend-kit'

import { GetTodayWordsHandler } from './handlers/todayWordsHandler.ts'
import type { WotdStore } from './store.ts'
import type { WordGenerator } from './wordGenerator.ts'

const t = createTRPC<WotdStore>()

/**
 * Router factory. The Store is injected per transport via the tRPC context; the
 * WordGenerator is injected here — fake in dev/.iwft, Anthropic in prod (the
 * generator seam). The handler runs unchanged across all transports.
 */
export function createAppRouter(generator: WordGenerator) {
  return t.router({
    todayWords: t.procedure.query(({ ctx }) =>
      new GetTodayWordsHandler(generator).run(undefined, ctx),
    ),
  })
}

/** Exported for the client and all transports. */
export type AppRouter = ReturnType<typeof createAppRouter>
