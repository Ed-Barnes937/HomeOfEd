// Real-Postgres leg: the same migrations + round-trip + feature suite, on the
// postgres driver. Gated on TEST_DATABASE_URL (skipped when unset) so CI/dev
// machines without a database still pass. Locally:
//
//   docker run -d --name hoe-db-test -p 5433:5432 \
//     -e POSTGRES_PASSWORD=postgres postgres:17
//   TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/postgres pnpm test
//
// Each test gets a freshly reset + migrated `public` schema.
import { sql } from 'drizzle-orm'
import type { Pool } from 'pg'
import { afterAll, describe, expect, it } from 'vitest'

import { applyMigrations, createDbClient, type DbClient } from './index.ts'
import { loadMigrationsFromDir } from './node.ts'
import { describePgFeatures } from './testing/featureSuite.ts'
import * as schema from './testing/schema.ts'

const url = process.env['TEST_DATABASE_URL']

const migrations = await loadMigrationsFromDir(
  new URL('./testing/migrations', import.meta.url).pathname,
)

let client: DbClient<typeof schema> | undefined

async function freshPostgresDb(): Promise<DbClient<typeof schema>> {
  if (!url) throw new Error('TEST_DATABASE_URL is not set')
  client ??= await createDbClient({ driver: 'postgres', schema, url })
  await client.execute(sql`drop schema public cascade`)
  await client.execute(sql`create schema public`)
  await applyMigrations(client, migrations)
  return client
}

afterAll(async () => {
  if (client) await (client as unknown as { $client: Pool }).$client.end()
})

describe.runIf(url)('real Postgres (TEST_DATABASE_URL)', () => {
  it('applies the generated migrations', async () => {
    const db = await freshPostgresDb()
    const tables = (await db.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    )) as { rows: Record<string, unknown>[] }
    expect(tables.rows.map((r) => r['table_name'])).toEqual(['items', 'tags'])
  })

  it('round-trips an insert and select', async () => {
    const db = await freshPostgresDb()
    await db.insert(schema.items).values({ name: 'widget', meta: { colour: 'red' } })
    const rows = await db.select().from(schema.items)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe('widget')
    expect(rows[0]?.meta).toEqual({ colour: 'red' })
  })

  describePgFeatures('PG features on real Postgres', freshPostgresDb)
})
