import { fileURLToPath } from 'node:url'

import { mintFamilyToken } from '@hoe/accounts/server'
import { TEST_FAMILY_PRIVATE_KEY } from '@hoe/accounts/testing'
import {
  ConsoleLogger,
  createContext,
  createDispatcher,
  InMemoryBlobStore,
  type Dispatch,
} from '@hoe/backend-kit'
import { freshTestDb } from '@hoe/db'
import { loadMigrationsFromDir } from '@hoe/db/node'

import { createAppRouter } from './router.ts'
import { familySchema } from './schema.ts'
import { DrizzleFamilyStore } from './store.ts'

/**
 * The backendSimulator: the REAL router + handlers over a PGlite-backed Store.
 * Better Auth is NOT wired here (sprout precedent) - the dev transport serves
 * only `/api/trpc`, so every request is anonymous and the identity procedures
 * refuse. Hub's account UI exercises them with `FakeFamilyClient` instead.
 */
export async function createSimulatorDispatch(): Promise<Dispatch> {
  // fs-based loader, not ./migrations.ts: this file is imported by
  // vite.config.ts in native Node, where Vite's import.meta.glob doesn't exist.
  const migrations = await loadMigrationsFromDir(
    fileURLToPath(new URL('./migrations', import.meta.url)),
  )
  const db = await freshTestDb(familySchema, migrations)
  return createDispatcher({
    router: createAppRouter({
      // The committed test keypair, so a dev hub can verify with its public
      // half. Never a deployed key.
      mintToken: (input) => mintFamilyToken(input, TEST_FAMILY_PRIVATE_KEY),
    }),
    createContext: createContext({
      store: new DrizzleFamilyStore(db),
      blobs: new InMemoryBlobStore(),
      logger: new ConsoleLogger({ app: 'family', mode: 'simulator' }),
    }),
  })
}
