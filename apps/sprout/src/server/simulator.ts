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

import { mintChildToken } from './auth/childToken.ts'
import { scryptHasher } from './password.ts'
import { createAppRouter } from './router.ts'
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
  const appRouter = createAppRouter({
    hasher: scryptHasher,
    // TODO(P5): wire the real pipeline summariser (HTTP over the private network).
    summarise: () => Promise.reject(new Error('pipeline summariser not wired yet (P5)')),
    // Dev/.iwft-adjacent Node minter: real HMAC over a dev-only secret (there is
    // no persistence in the simulator, so a fixed insecure secret is fine).
    mintChildToken: (claims) =>
      mintChildToken(claims, process.env.CHILD_SESSION_SECRET ?? 'dev-insecure-child-session-secret'),
  })
  return createDispatcher({
    router: appRouter,
    createContext: createContext({
      store,
      blobs: new InMemoryBlobStore(),
      logger: new ConsoleLogger({ app: 'sprout', mode: 'simulator' }),
    }),
  })
}
