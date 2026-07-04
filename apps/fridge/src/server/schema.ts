import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import type { StoredBoard } from './boardSchema.ts'

/**
 * Shared fridge boards: immutable anonymous snapshots (ADR 0010). One row per
 * published board; `payload` is the whole `StoredBoard` (validated in and out
 * by `storedBoardSchema`). `w`/`h`/`z`/`id` are recomputed on import, never
 * stored — the payload only carries per-magnet type/label/deg/color/x/y/rot.
 */
export const sharedBoards = pgTable('shared_boards', {
  id: text('id').primaryKey(), // 10-char base62
  name: text('name').notNull(),
  payload: jsonb('payload').$type<StoredBoard>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const fridgeSchema = { sharedBoards }
export type FridgeSchema = typeof fridgeSchema
