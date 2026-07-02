import {
  ConsoleLogger,
  createContext,
  createDispatcher,
  InMemoryBlobStore,
  type Dispatch,
} from '@hoe/backend-kit'
import { freshTestDb } from '@hoe/db'

import { migrations } from './migrations.ts'
import { appRouter } from './router.ts'
import { hubSchema } from './schema.ts'
import { DrizzleHealthStore } from './store.ts'

/**
 * The backendSimulator: the REAL router + handlers with a PGlite-backed Store
 * injected. Reused by dev simulator mode (Vite middleware, Node-side PGlite)
 * and by .iwft (in-browser PGlite-WASM via exposeDispatcher).
 */
export async function createSimulatorDispatch(): Promise<Dispatch> {
  const db = await freshTestDb(hubSchema, migrations)
  const store = new DrizzleHealthStore(db)
  return createDispatcher({
    router: appRouter,
    createContext: createContext({
      store,
      blobs: new InMemoryBlobStore(),
      logger: new ConsoleLogger({ app: 'hub', mode: 'simulator' }),
    }),
  })
}
