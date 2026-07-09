// Browser side of the .iwft harness: pull the real backend (router + handlers)
// into the CT bundle and expose its dispatcher for the page.route trampoline.
// Module init runs once per test page.
//
// No database (ADR 0008): the harness wires the real router with NO Store — no
// PGlite, no seeding. It still wires the test-auth seam so mountApp({ user })
// exercises auth without a DB, which is exactly ADR 0008's point: auth is
// decentralised, not backed by each app's own database.
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

exposeDispatcher(
  createDispatcher({
    router: appRouter,
    createContext: createContext<void>({
      store: undefined,
      blobs: new InMemoryBlobStore(),
      logger: new ConsoleLogger({ app: 'inksplat', mode: 'iwft' }),
      auth: testUserAuth,
    }),
  }),
)

export function IwftApp() {
  return <App />
}
