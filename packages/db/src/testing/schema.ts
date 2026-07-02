// Test-only Drizzle schema. Exercises the Postgres features apps may rely on
// (uuid defaults, JSONB, constraints, FKs) — see pgFeatures.test.ts. Real apps
// own their schema; this one exists so @hoe/db can test generate+apply and the
// PGlite fidelity evidence list against a realistic shape.
import { sql } from 'drizzle-orm'
import { integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'

export const items = pgTable('items', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull().unique(),
  count: integer('count').notNull().default(0),
  meta: jsonb('meta').$type<Record<string, unknown>>(),
})

export const tags = pgTable('tags', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  itemId: uuid('item_id')
    .notNull()
    .references(() => items.id),
  label: text('label').notNull(),
})
