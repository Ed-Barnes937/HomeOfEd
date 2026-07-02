// Browser side of the .iwft harness: pull the real backend (router + PGlite
// WASM + in-memory blobs) into the CT bundle and expose its dispatcher for the
// page.route trampoline. Module init runs once per test page = fresh DB per test.
//
// Unlike dev's createSimulatorDispatch(), the harness wires the backend itself:
// it needs the DbClient handle (to run mountApp({ seed }) before the first
// query) and the test-auth seam (mountApp({ user }) header → ctx.auth), which
// the simulator's dispatch-only factory deliberately doesn't expose.
import {
  ConsoleLogger,
  createContext,
  createDispatcher,
  exposeDispatcher,
  InMemoryBlobStore,
} from '@hoe/backend-kit'
import { freshTestDb } from '@hoe/db'
import { applyPendingSeed, testUserAuth } from '@hoe/test-kit/browser'

import { App } from '../App.tsx'
import { migrations } from '../server/migrations.ts'
import { appRouter } from '../server/router.ts'
import { hubSchema } from '../server/schema.ts'
import { DrizzleHealthStore } from '../server/store.ts'

exposeDispatcher(
  (async () => {
    // Fresh PGlite, migrated, then any stashed seed — all before the
    // dispatcher exists, so seeding always precedes the app's first query.
    const db = await applyPendingSeed(await freshTestDb(hubSchema, migrations))
    return createDispatcher({
      router: appRouter,
      createContext: createContext({
        store: new DrizzleHealthStore(db),
        blobs: new InMemoryBlobStore(),
        logger: new ConsoleLogger({ app: 'hub', mode: 'iwft' }),
        auth: testUserAuth,
      }),
    })
  })(),
)

export function IwftApp() {
  return <App />
}
