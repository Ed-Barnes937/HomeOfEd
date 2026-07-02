// The PG feature evidence suite, parameterised over a db factory so the SAME
// assertions run on PGlite (always — pgFeatures.test.ts) and on real Postgres
// (when TEST_DATABASE_URL is set — postgres.test.ts). Each feature here is one
// apps are allowed to rely on; keep in sync with the README list.
import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import type { DbClient } from '../index.ts'
import * as schema from './schema.ts'

/** Returns a client with the test schema freshly migrated and empty. */
export type MakeFeatureDb = () => Promise<DbClient<typeof schema>>

/** Drizzle wraps driver errors; the constraint detail lives on `cause`. */
async function rejectionMessage(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    const cause = (error as Error).cause
    return cause instanceof Error ? cause.message : String(error)
  }
  throw new Error('expected the query to reject')
}

export function describePgFeatures(title: string, makeDb: MakeFeatureDb): void {
  describe(title, () => {
    let db: DbClient<typeof schema>

    beforeEach(async () => {
      db = await makeDb()
    })

    it('gen_random_uuid() generates column defaults', async () => {
      const [row] = await db.insert(schema.items).values({ name: 'a' }).returning()
      expect(row?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })

    it('JSONB operators: ->> extraction and @> containment', async () => {
      await db.insert(schema.items).values([
        { name: 'red-thing', meta: { colour: 'red', size: 3 } },
        { name: 'blue-thing', meta: { colour: 'blue' } },
      ])
      const extracted = (await db.execute(
        sql`select name, meta ->> 'colour' as colour from items order by name`,
      )) as { rows: Record<string, unknown>[] }
      expect(extracted.rows).toEqual([
        { name: 'blue-thing', colour: 'blue' },
        { name: 'red-thing', colour: 'red' },
      ])
      const contained = await db
        .select({ name: schema.items.name })
        .from(schema.items)
        .where(sql`${schema.items.meta} @> '{"colour":"red"}'::jsonb`)
      expect(contained).toEqual([{ name: 'red-thing' }])
    })

    it('transactions: commit persists, throw rolls back', async () => {
      await db.transaction(async (tx) => {
        await tx.insert(schema.items).values({ name: 'committed' })
      })
      await expect(
        db.transaction(async (tx) => {
          await tx.insert(schema.items).values({ name: 'rolled-back' })
          throw new Error('abort')
        }),
      ).rejects.toThrow('abort')
      const rows = await db.select().from(schema.items)
      expect(rows.map((r) => r.name)).toEqual(['committed'])
    })

    it('NOT NULL and UNIQUE constraints reject bad rows', async () => {
      expect(
        await rejectionMessage(db.execute(sql`insert into items (name) values (null)`)),
      ).toMatch(/null value/i)
      await db.insert(schema.items).values({ name: 'dup' })
      expect(await rejectionMessage(db.insert(schema.items).values({ name: 'dup' }))).toMatch(
        /unique|duplicate key/i,
      )
    })

    it('FOREIGN KEY constraints reject orphan rows', async () => {
      expect(
        await rejectionMessage(
          db.insert(schema.tags).values({
            itemId: '00000000-0000-0000-0000-000000000000',
            label: 'orphan',
          }),
        ),
      ).toMatch(/foreign key/i)
    })

    it('ON CONFLICT: DO NOTHING skips, DO UPDATE upserts', async () => {
      await db.insert(schema.items).values({ name: 'thing', count: 1 })
      await db.insert(schema.items).values({ name: 'thing', count: 99 }).onConflictDoNothing()
      let [row] = await db.select().from(schema.items).where(eq(schema.items.name, 'thing'))
      expect(row?.count).toBe(1)

      await db
        .insert(schema.items)
        .values({ name: 'thing', count: 99 })
        .onConflictDoUpdate({
          target: schema.items.name,
          set: { count: sql`excluded.count` },
        })
      ;[row] = await db.select().from(schema.items).where(eq(schema.items.name, 'thing'))
      expect(row?.count).toBe(99)
    })
  })
}
