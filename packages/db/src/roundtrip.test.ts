import { describe, expect, it } from 'vitest'

import { freshTestDb, seedDb, type SeedFn } from './index.ts'
import { loadMigrationsFromDir } from './node.ts'
import * as schema from './testing/schema.ts'

const migrations = await loadMigrationsFromDir(
  new URL('./testing/migrations', import.meta.url).pathname,
)

describe('PGlite round-trip (Node)', () => {
  it('inserts and reads back through the Drizzle client', async () => {
    const db = await freshTestDb(schema, migrations)
    await db.insert(schema.items).values({ name: 'widget', meta: { colour: 'red' } })
    const rows = await db.select().from(schema.items)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe('widget')
    expect(rows[0]?.meta).toEqual({ colour: 'red' })
  })
})

describe('freshTestDb = per-test reset', () => {
  it('gives each test an isolated, already-migrated database', async () => {
    const a = await freshTestDb(schema, migrations)
    const b = await freshTestDb(schema, migrations)
    await a.insert(schema.items).values({ name: 'only-in-a' })
    expect(await a.select().from(schema.items)).toHaveLength(1)
    expect(await b.select().from(schema.items)).toHaveLength(0)
  })
})

describe('seedDb', () => {
  const seedItems: SeedFn<typeof schema> = async (db) => {
    await db.insert(schema.items).values({ name: 'seeded' })
  }

  it('runs a seed function against the client', async () => {
    const db = await freshTestDb(schema, migrations)
    await seedDb(db, seedItems)
    const rows = await db.select().from(schema.items)
    expect(rows.map((r) => r.name)).toEqual(['seeded'])
  })

  it('runs multiple seeds in order', async () => {
    const order: string[] = []
    const db = await freshTestDb(schema, migrations)
    await seedDb(
      db,
      async () => {
        order.push('first')
        await Promise.resolve()
      },
      async () => {
        order.push('second')
        await Promise.resolve()
      },
    )
    expect(order).toEqual(['first', 'second'])
  })
})
