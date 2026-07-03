import {
  ConsoleLogger,
  createContext,
  createDispatcher,
  InMemoryBlobStore,
  type Dispatch,
} from '@hoe/backend-kit'

import { appRouter } from './router.ts'
import { InMemoryStatusStore } from './store.ts'

/**
 * The backendSimulator: the REAL router + handlers over InMemoryStatusStore.
 * No database (ADR 0006), so unlike hub's PGlite-backed version this needs no
 * async setup — it's wrapped in a resolved promise only to match
 * simulatorPlugin's `() => Promise<Dispatch>` contract. Reused by dev
 * simulator mode (Vite middleware) and by .iwft (in-browser, via
 * exposeDispatcher in testing/IwftApp.tsx).
 */
export function createSimulatorDispatch(): Promise<Dispatch> {
  const store = new InMemoryStatusStore()
  return Promise.resolve(
    createDispatcher({
      router: appRouter,
      createContext: createContext({
        store,
        blobs: new InMemoryBlobStore(),
        logger: new ConsoleLogger({ app: 'boids', mode: 'simulator' }),
      }),
    }),
  )
}
