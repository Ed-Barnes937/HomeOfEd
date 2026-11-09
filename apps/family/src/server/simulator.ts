import {
  ConsoleLogger,
  createContext,
  createDispatcher,
  InMemoryBlobStore,
  type Dispatch,
} from '@hoe/backend-kit'

import { appRouter } from './router.ts'

/** The real router with no Store injected; ticket 03 adds PGlite and migrations here. */
export function createSimulatorDispatch(): Promise<Dispatch> {
  return Promise.resolve(
    createDispatcher({
      router: appRouter,
      createContext: createContext<void>({
        store: undefined,
        blobs: new InMemoryBlobStore(),
        logger: new ConsoleLogger({ app: 'family', mode: 'simulator' }),
      }),
    }),
  )
}
