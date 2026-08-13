import { createTRPC, ValidationError } from '@hoe/backend-kit'

import { GetTodayWordsHandler } from './handlers/todayWordsHandler.ts'
import { GetYesterdayWordHandler } from './handlers/yesterdayWordHandler.ts'
import type { WotdStore } from './store.ts'
import { DIFFICULTIES, type Difficulty, type WordGenerator } from './wordGenerator.ts'

const t = createTRPC<WotdStore>()

/** Input parser for level-keyed procedures (no zod in this app). */
function parseDifficulty(value: unknown): Difficulty {
  if (typeof value === 'string' && (DIFFICULTIES as readonly string[]).includes(value)) {
    return value as Difficulty
  }
  throw new ValidationError(`invalid difficulty: ${String(value)}`)
}

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
    // Read-only by design: no generator is passed in, so it can never generate.
    yesterdayWord: t.procedure.input(parseDifficulty).query(({ input, ctx }) =>
      new GetYesterdayWordHandler().run(input, ctx),
    ),
  })
}

/** Exported for the client and all transports. */
export type AppRouter = ReturnType<typeof createAppRouter>
