import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { createDbClient, migrationsFromFiles } from './index.ts'
import { loadMigrationsFromDir } from './node.ts'
import * as schema from './testing/schema.ts'

const migrationsDir = new URL('./testing/migrations', import.meta.url).pathname

describe('migrationsFromFiles', () => {
  it('orders files by name and splits on drizzle statement breakpoints', () => {
    const statements = migrationsFromFiles({
      '0001_second.sql': 'create table b (id int);',
      '0000_first.sql': 'create table a (id int);\n--> statement-breakpoint\ncreate index a_idx on a (id);',
    })
    expect(statements).toEqual([
      'create table a (id int);',
      'create index a_idx on a (id);',
      'create table b (id int);',
    ])
  })

  it('drops empty fragments', () => {
    expect(migrationsFromFiles({ 'x.sql': '--> statement-breakpoint\n' })).toEqual([])
  })
})

describe('loadMigrationsFromDir (Node)', () => {
  it('loads only .sql files from a drizzle-kit output folder, ignoring meta/', async () => {
    const statements = await loadMigrationsFromDir(migrationsDir)
    expect(statements.length).toBeGreaterThanOrEqual(3)
    expect(statements[0]).toContain('CREATE TABLE "items"')
    expect(statements.every((s) => s.trim().length > 0)).toBe(true)
  })

  it('produces statements that apply cleanly to a fresh PGlite', async () => {
    const migrations = await loadMigrationsFromDir(migrationsDir)
    const db = await createDbClient({ driver: 'pglite', schema })
    const { applyMigrations } = await import('./index.ts')
    await applyMigrations(db, migrations)
    const tables = (await db.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    )) as { rows: Record<string, unknown>[] }
    expect(tables.rows.map((r) => r['table_name'])).toEqual(['items', 'tags'])
  })
})
