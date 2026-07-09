// Browser side of the .iwft harness: expose the real router's dispatcher for
// the page.route trampoline. karesansui has no database (ADR 0008), so —
// unlike hub — there's no DbClient handle to seed and no async setup:
// mountApp's `seed` option is simply never used. The `failures` link and
// testUserAuth auth seam are DB-independent and still work.
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
import { InMemoryStatusStore } from '../server/store.ts'

exposeDispatcher(
  createDispatcher({
    router: appRouter,
    createContext: createContext({
      store: new InMemoryStatusStore(),
      blobs: new InMemoryBlobStore(),
      logger: new ConsoleLogger({ app: 'karesansui', mode: 'iwft' }),
      auth: testUserAuth,
    }),
  }),
)

export function IwftApp() {
  return <App />
}
