import { eq, sql } from 'drizzle-orm'
import type { DbClient } from '@hoe/db'

import { wordsTable, type WotdSchema } from './schema.ts'

/** A persisted word row (`YYYY-MM-DD` dates as strings, string-mode). */
export type WordRow = typeof wordsTable.$inferSelect
/** An insert row for {@link WotdStore.insertWords}. */
export type NewWordRow = typeof wordsTable.$inferInsert

/**
 * wotd's Store interface — its whole server-side query surface. Handlers depend
 * on this; "real vs simulator" is just the injected DbClient's driver. Dates are
 * `YYYY-MM-DD` strings end to end (never Date objects at this boundary).
 */
export interface WotdStore {
  getWordsForDate(date: string): Promise<WordRow[]>
  /** Insert daily words; on conflict (for_date, difficulty) do nothing. */
  insertWords(rows: NewWordRow[]): Promise<void>
  /** Liveness round-trip for the deep /health check. */
  ping(): Promise<void>
}

export class DrizzleWotdStore implements WotdStore {
  private readonly db: DbClient<WotdSchema>

  constructor(db: DbClient<WotdSchema>) {
    this.db = db
  }

  getWordsForDate(date: string): Promise<WordRow[]> {
    return this.db.select().from(wordsTable).where(eq(wordsTable.forDate, date))
  }

  async insertWords(rows: NewWordRow[]): Promise<void> {
    if (rows.length === 0) return
    // Conflict-ignore fills gaps and resolves concurrent-generation races.
    await this.db.insert(wordsTable).values(rows).onConflictDoNothing()
  }

  async ping(): Promise<void> {
    await this.db.execute(sql`select 1`)
  }
}
