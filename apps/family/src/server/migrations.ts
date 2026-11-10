// The generated migrations (drizzle-kit, `pnpm generate`) as the ordered
// statement list `applyMigrations`/`freshTestDb` expect. This loader uses
// Vite's `?raw` glob, so it works anywhere Vite transforms code (the .iwft
// browser bundle, vitest). Node contexts outside Vite (the dev simulator via
// vite.config.ts, prod's migrate entrypoint) load the same folder with
// `@hoe/db/node` instead.
import { migrationsFromFiles } from '@hoe/db'

const files = import.meta.glob<string>('./migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export const migrations: readonly string[] = migrationsFromFiles(files)
