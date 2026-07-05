import { Handler, type AppContext } from '@hoe/backend-kit'

import type { WordRow, WotdStore } from '../store.ts'
import type { WordGenerator, WordOfTheDay } from '../wordGenerator.ts'

/** UTC `YYYY-MM-DD` — "today" for the day boundary. */
export function toUtcDate(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/** Store row → wire type (renames `alternatives` → `synonyms`). */
export function toWire(row: WordRow): WordOfTheDay {
  return {
    difficulty: row.difficulty,
    word: row.word,
    definition: row.definition,
    exampleSentence: row.exampleSentence,
    synonyms: row.alternatives,
  }
}

/**
 * STUB pinned in step 3 so the frontend lane has a working backend for seeded
 * reads. Serves today's words from the store; the lazy-generation, race
 * tolerance, and throw-on-incomplete-reselect semantics are built by the backend
 * lane (step 4, TDD) using the injected {@link WordGenerator}.
 */
export class GetTodayWordsHandler extends Handler<void, WordOfTheDay[], WotdStore> {
  constructor(private readonly generator: WordGenerator) {
    super()
  }

  async run(_input: void, ctx: AppContext<WotdStore>): Promise<WordOfTheDay[]> {
    const today = toUtcDate(ctx.now())
    const rows = await ctx.store.getWordsForDate(today)
    return rows.map(toWire)
  }
}
