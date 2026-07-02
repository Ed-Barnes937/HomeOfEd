// Node-only helpers (fs access). Exposed as `@hoe/db/node` so they never
// enter a browser bundle — the main entry stays environment-agnostic.
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { migrationsFromFiles } from './index.ts'

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
