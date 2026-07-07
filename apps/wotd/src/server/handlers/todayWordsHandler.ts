import { Handler, type AppContext } from '@hoe/backend-kit'

import type { NewWordRow, WordRow, WotdStore } from '../store.ts'
import { DIFFICULTIES, type GeneratedWord, type WordGenerator, type WordOfTheDay } from '../wordGenerator.ts'

/** How far back a word counts as a repeat, and how many times we retry. */
const HISTORY_WINDOW_DAYS = 90
const MAX_GENERATION_ATTEMPTS = 3

/** UTC `YYYY-MM-DD` — "today" for the day boundary. */
export function toUtcDate(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/** UTC `YYYY-MM-DD`, `days` before `now` — the no-repeat window's cutoff. */
function daysAgoUtc(now: Date, days: number): string {
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() - days)
  return toUtcDate(d)
}

/** True if any generated word repeats a recent word or another in the batch. */
function hasRepeat(generated: GeneratedWord[], recent: Set<string>): boolean {
  const seen = new Set<string>()
  for (const g of generated) {
    const key = g.word.toLowerCase().trim()
    if (recent.has(key) || seen.has(key)) return true
    seen.add(key)
  }
  return false
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
  // Explicit field assignment, not a parameter property: prod runs the TS source
  // under Node's strip-only mode (ADR 0004), which rejects parameter properties.
  private readonly generator: WordGenerator

  constructor(generator: WordGenerator) {
    super()
    this.generator = generator
  }

  async run(_input: void, ctx: AppContext<WotdStore>): Promise<WordOfTheDay[]> {
    const today = toUtcDate(ctx.now())
    const rows = await ctx.store.getWordsForDate(today)
    if (isComplete(rows)) return rows.map(toWire)

    // No repeats: exclude words used within the window, retrying if the model
    // repeats anyway. On exhaustion we accept the set — never block the user.
    const cutoff = daysAgoUtc(ctx.now(), HISTORY_WINDOW_DAYS)
    const recentWords = await ctx.store.getRecentWords(cutoff)
    const recent = new Set(recentWords.map((w) => w.toLowerCase().trim()))

    let generated = await this.generator.generateDailyWords(recentWords)
    for (
      let attempt = 1;
      attempt < MAX_GENERATION_ATTEMPTS && hasRepeat(generated, recent);
      attempt += 1
    ) {
      generated = await this.generator.generateDailyWords(recentWords)
    }

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
