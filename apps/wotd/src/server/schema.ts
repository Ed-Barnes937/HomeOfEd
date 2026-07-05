import { sql } from 'drizzle-orm'
import { date, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

// The four difficulty levels, one word generated per level per day.
export const difficultyLevel = pgEnum('difficulty_level', [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
])

export const wordsTable = pgTable(
  'words',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    word: text('word').notNull(),
    definition: text('definition').notNull(),
    exampleSentence: text('example_sentence').notNull(),
    // synonyms on the wire; the column stays `alternatives` (Supabase heritage).
    alternatives: text('alternatives').array().notNull(),
    difficulty: difficultyLevel('difficulty').notNull(),
    // `YYYY-MM-DD` string end to end (string mode) so PGlite and Postgres can't
    // drift on timezone handling. Replaces the old `todaywords` view.
    forDate: date('for_date', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  // One word per (day, level): makes lazy daily generation idempotent and
  // concurrent generation race-safe (conflicting inserts are ignored).
  (t) => [unique().on(t.forDate, t.difficulty)],
)

export const wotdSchema = { words: wordsTable }
export type WotdSchema = typeof wotdSchema
