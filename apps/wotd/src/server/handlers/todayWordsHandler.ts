import { Handler, type AppContext } from '@hoe/backend-kit'

import type { NewWordRow, WordRow, WotdStore } from '../store.ts'
import { DIFFICULTIES, type WordGenerator, type WordOfTheDay } from '../wordGenerator.ts'

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

function isComplete(rows: WordRow[]): boolean {
  return DIFFICULTIES.every((difficulty) => rows.some((row) => row.difficulty === difficulty))
}

/**
 * Serves today's words from the store, lazily generating them on first read of
 * the day. Tolerates concurrent generation races (conflict-ignore insert) but
 * throws if the store is still incomplete after a fresh generation + insert.
 */
export class GetTodayWordsHandler extends Handler<void, WordOfTheDay[], WotdStore> {
  constructor(private readonly generator: WordGenerator) {
    super()
  }

  async run(_input: void, ctx: AppContext<WotdStore>): Promise<WordOfTheDay[]> {
    const today = toUtcDate(ctx.now())
    const rows = await ctx.store.getWordsForDate(today)
    if (isComplete(rows)) return rows.map(toWire)

    const generated = await this.generator.generateDailyWords()
    const newRows: NewWordRow[] = generated.map((g) => ({
      word: g.word,
      definition: g.definition,
      exampleSentence: g.exampleSentence,
      alternatives: g.synonyms,
      difficulty: g.difficulty,
      forDate: today,
    }))
    await ctx.store.insertWords(newRows)

    const reselected = await ctx.store.getWordsForDate(today)
    if (!isComplete(reselected)) {
      throw new Error('word generation incomplete for ' + today)
    }
    return reselected.map(toWire)
  }
}
