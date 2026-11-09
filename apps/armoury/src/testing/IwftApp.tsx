// Browser side of the .iwft harness: the real router + handlers (no Store,
// ADR 0008) and the app with its three.js stage swapped for FakeStage.
import {
  ConsoleLogger,
  createContext,
  createDispatcher,
  exposeDispatcher,
  InMemoryBlobStore,
} from '@hoe/backend-kit'
import { testUserAuth } from '@hoe/test-kit/browser'

import { App } from '../App.tsx'
import { appRouter } from '../server/router.ts'
import { fakeStages } from './FakeStage.tsx'

exposeDispatcher(
  createDispatcher({
    router: appRouter,
    createContext: createContext<void>({
      store: undefined,
      blobs: new InMemoryBlobStore(),
      logger: new ConsoleLogger({ app: 'armoury', mode: 'iwft' }),
      auth: testUserAuth,
    }),
  }),
)

export function IwftApp() {
  return <App stages={fakeStages} />
}
