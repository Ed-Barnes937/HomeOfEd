import { freshTestDb } from '@hoe/db'
import { describe, expect, it } from 'vitest'

import { migrations } from './migrations.ts'
import { hubSchema } from './schema.ts'
import { DrizzleHealthStore } from './store.ts'

describe('DrizzleHealthStore over PGlite with the generated migrations', () => {
  it('pings the value seeded by the migrations', async () => {
    const db = await freshTestDb(hubSchema, migrations)
    const store = new DrizzleHealthStore(db)
    await expect(store.ping()).resolves.toEqual({ ok: true, value: 'hello from postgres' })
  })

  it('falls back to a placeholder when the health table is empty', async () => {
    const db = await freshTestDb(hubSchema, migrations)
    await db.delete(hubSchema.health)
    const store = new DrizzleHealthStore(db)
    await expect(store.ping()).resolves.toEqual({ ok: true, value: '(health table empty)' })
  })
})
