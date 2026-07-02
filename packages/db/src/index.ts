import { sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

export type Driver = 'postgres' | 'pglite'

export type DbSchema = Record<string, unknown>

/**
 * A Drizzle client bound to the app's schema. Which driver backs it
 * (real Postgres vs PGlite) is invisible to consumers — handlers and Store
 * impls depend on this type only.
 */
export type DbClient<S extends DbSchema> = PgDatabase<PgQueryResultHKT, S>

export type CreateDbClientOpts<S extends DbSchema> =
  | { driver: 'postgres'; schema: S; url: string }
  | { driver: 'pglite'; schema: S; dataDir?: string }

/**
 * Driver-swap factory. Drivers are loaded lazily so that:
 * - `pg` (Node-only) never enters a browser bundle — the import is marked
 *   `@vite-ignore` so bundlers leave it alone;
 * - `@electric-sql/pglite` can be excluded from production builds (finalised
 *   in T2.1 with a CI assertion).
 */
export async function createDbClient<S extends DbSchema>(
  opts: CreateDbClientOpts<S>,
): Promise<DbClient<S>> {
  if (opts.driver === 'postgres') {
    const { drizzle } = await import(/* @vite-ignore */ 'drizzle-orm/node-postgres')
    return drizzle(opts.url, { schema: opts.schema })
  }
  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  return drizzle(new PGlite(opts.dataDir), { schema: opts.schema })
}

/** Apply SQL migrations in order. T2.1 replaces hand-written SQL with a generate+apply runner. */
export async function applyMigrations(
  db: DbClient<DbSchema>,
  migrations: readonly string[],
): Promise<void> {
  for (const statement of migrations) {
    await db.execute(sql.raw(statement))
  }
}

/**
 * A brand-new in-memory PGlite, migrated at creation. One per test = per-test
 * isolation (the WASM binary loads once per process/page, instances are cheap).
 */
export async function freshTestDb<S extends DbSchema>(
  schema: S,
  migrations: readonly string[],
): Promise<DbClient<S>> {
  const db = await createDbClient({ driver: 'pglite', schema })
  await applyMigrations(db, migrations)
  return db
}
