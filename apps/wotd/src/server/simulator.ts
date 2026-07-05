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

import { FakeWordGenerator } from '../testing/fakeWordGenerator.ts'
import { createAppRouter } from './router.ts'
import { wotdSchema } from './schema.ts'
import { DrizzleWotdStore } from './store.ts'

/**
 * The backendSimulator: the REAL router + handlers with a PGlite-backed Store and
 * the FakeWordGenerator injected. Reused by dev simulator mode (Vite middleware,
 * Node-side PGlite). Dev never hits the Anthropic API.
 */
export async function createSimulatorDispatch(): Promise<Dispatch> {
  // fs-based loader, not ./migrations.ts: this file is imported by
  // vite.config.ts in native Node, where Vite's import.meta.glob doesn't exist.
  const migrations = await loadMigrationsFromDir(
    fileURLToPath(new URL('./migrations', import.meta.url)),
  )
  const db = await freshTestDb(wotdSchema, migrations)
  const store = new DrizzleWotdStore(db)
  return createDispatcher({
    router: createAppRouter(new FakeWordGenerator()),
    createContext: createContext({
      store,
      blobs: new InMemoryBlobStore(),
      logger: new ConsoleLogger({ app: 'wotd', mode: 'simulator' }),
    }),
  })
}
