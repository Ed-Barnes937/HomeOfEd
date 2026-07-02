// Node-only helpers (fs access). Exposed as `@hoe/db/node` so they never
// enter a browser bundle — the main entry stays environment-agnostic.
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

import { migrationsFromFiles } from './index.ts'

/**
 * Run-once migrations against real Postgres — the deploy `release_command`.
 * Uses drizzle's journal-tracked migrator (ledger in
 * `drizzle.__drizzle_migrations`), so it's safe to run on every deploy:
 * already-applied entries are skipped. Contrast `applyMigrations`, which has
 * fresh-database semantics and executes every statement unconditionally.
 * `migrationsFolder` is a drizzle-kit output dir (needs its `meta/` journal).
 */
export async function migratePostgres(url: string, migrationsFolder: string): Promise<void> {
  const db = drizzle(url)
  try {
    await migrate(db, { migrationsFolder })
  } finally {
    await db.$client.end()
  }
}

/**
 * Load a drizzle-kit output folder (top-level `NNNN_*.sql` files; `meta/` is
 * ignored) into the ordered statement list `applyMigrations` expects.
 */
export async function loadMigrationsFromDir(dir: string): Promise<readonly string[]> {
  const entries = await readdir(dir)
  const files: Record<string, string> = {}
  for (const name of entries.filter((e) => e.endsWith('.sql')).sort()) {
    files[name] = await readFile(join(dir, name), 'utf8')
  }
  return migrationsFromFiles(files)
}
