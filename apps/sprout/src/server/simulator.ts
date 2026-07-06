import {
  ConsoleLogger,
  createContext,
  createDispatcher,
  InMemoryBlobStore,
  type Dispatch,
} from '@hoe/backend-kit'
import { fileURLToPath } from 'node:url'

import { freshTestDb } from '@hoe/db'
import { loadMigrationsFromDir } from '@hoe/db/node'

import { appRouter } from './router.ts'
import { sproutSchema } from './schema.ts'
import { DrizzleSproutStore } from './store.ts'

/**
 * The backendSimulator: the REAL router + handlers with a PGlite-backed Store
 * injected (plan §6). Reused by dev simulator mode (Vite middleware, Node-side
 * PGlite) and shared with .iwft's in-browser PGlite-WASM harness.
 */
export async function createSimulatorDispatch(): Promise<Dispatch> {
  // fs-based loader, not ./migrations.ts: this file is imported by
  // vite.config.ts in native Node, where Vite's import.meta.glob doesn't exist.
  const migrations = await loadMigrationsFromDir(
    fileURLToPath(new URL('./migrations', import.meta.url)),
  )
  const db = await freshTestDb(sproutSchema, migrations)
  const store = new DrizzleSproutStore(db)
  return createDispatcher({
    router: appRouter,
    createContext: createContext({
      store,
      blobs: new InMemoryBlobStore(),
      logger: new ConsoleLogger({ app: 'sprout', mode: 'simulator' }),
    }),
  })
}
