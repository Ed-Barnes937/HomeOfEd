import {
  ConsoleLogger,
  createContext,
  createDispatcher,
  InMemoryBlobStore,
  type Dispatch,
} from '@hoe/backend-kit'

import { appRouter } from './router.ts'

/**
 * The backendSimulator for a stateless app: the REAL router + handlers with no
 * Store injected (ADR 0008). Reused by dev simulator mode (Vite middleware) and
 * sharing the router with .iwft. No PGlite, no migrations — nothing to persist.
 *
 * Returns a Promise to match the `createDispatch` contract (a DB-backed app
 * awaits PGlite creation + migration here); the stateless case has nothing to
 * await, so it isn't `async`.
 */
export function createSimulatorDispatch(): Promise<Dispatch> {
  return Promise.resolve(
    createDispatcher({
      router: appRouter,
      createContext: createContext<void>({
        store: undefined,
        blobs: new InMemoryBlobStore(),
        logger: new ConsoleLogger({ app: 'inksplat', mode: 'simulator' }),
      }),
    }),
  )
}
