// Run-once migrations for production: unlike `applyMigrations` (fresh-DB
// semantics, executes everything), `migratePostgres` uses drizzle's
// journal-tracked migrator, so a deploy's release_command can run it every
// time — already-applied entries are skipped. Gated on TEST_DATABASE_URL
// exactly like postgres.test.ts (see there for the docker one-liner).
//
// Runs in its OWN database (created here) — postgres.test.ts resets the
// `public` schema of the main test database per test, and vitest runs files
// in parallel, so sharing it would race.
import { sql } from 'drizzle-orm'
import type { Pool } from 'pg'
import { describe, expect, it } from 'vitest'

import { createDbClient, type DbClient, type DbSchema } from './index.ts'
import { migratePostgres } from './node.ts'
import * as schema from './testing/schema.ts'

const adminUrl = process.env['TEST_DATABASE_URL']
const migrationsDir = new URL('./testing/migrations', import.meta.url).pathname

async function withDb<S extends DbSchema, T>(
  url: string,
  s: S,
  fn: (db: DbClient<S>) => Promise<T>,
): Promise<T> {
  const db = await createDbClient({ driver: 'postgres', schema: s, url })
  try {
    return await fn(db)
  } finally {
    await (db as unknown as { $client: Pool }).$client.end()
  }
}

describe.runIf(adminUrl)('migratePostgres (TEST_DATABASE_URL)', () => {
  it('applies pending migrations, and re-running is a tracked no-op', async () => {
    await withDb(adminUrl!, {}, async (db) => {
      await db.execute(sql`drop database if exists migrator_test with (force)`)
      await db.execute(sql`create database migrator_test`)
    })
    const url = new URL(adminUrl!)
    url.pathname = '/migrator_test'

    await migratePostgres(url.href, migrationsDir)
    // Second run must be a no-op: without journal tracking the CREATE TABLEs
    // would fail here.
    await migratePostgres(url.href, migrationsDir)

    await withDb(url.href, schema, async (db) => {
      const result = (await db.execute(sql`select count(*)::int as n from items`)) as {
        rows: Record<string, unknown>[]
      }
      expect(result.rows[0]).toEqual({ n: 0 })
    })
  })
})
