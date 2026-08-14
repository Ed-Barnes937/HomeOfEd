import { Handler, type AppContext } from '@hoe/backend-kit'

import type { WotdStore } from '../store.ts'
import type { Difficulty, YesterdayWord } from '../wordGenerator.ts'
import { daysAgoUtc } from './todayWordsHandler.ts'

/**
 * Read-only lookup of yesterday's word for one level — feeds the Yesterday
 * strip. Deliberately has no generator seam: a missing row means the strip is
 * hidden, never that a word gets generated.
 */
export class GetYesterdayWordHandler extends Handler<Difficulty, YesterdayWord | null, WotdStore> {
  async run(level: Difficulty, ctx: AppContext<WotdStore>): Promise<YesterdayWord | null> {
    const rows = await ctx.store.getWordsForDate(daysAgoUtc(ctx.now(), 1))
    const row = rows.find((r) => r.difficulty === level)
    if (!row) return null
    return { word: row.word, wordType: row.wordType, definition: row.definition }
  }
}
