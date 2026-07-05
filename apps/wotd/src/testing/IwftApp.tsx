// Browser side of the .iwft harness: pull the real backend (router + PGlite WASM
// + FakeWordGenerator) into the CT bundle and expose its dispatcher for the
// page.route trampoline. Module init runs once per test page = fresh DB per test.
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
import { createAppRouter } from '../server/router.ts'
import { migrations } from '../server/migrations.ts'
import { wotdSchema } from '../server/schema.ts'
import { DrizzleWotdStore } from '../server/store.ts'
import { FakeWordGenerator } from './fakeWordGenerator.ts'

exposeDispatcher(
  (async () => {
    // Fresh PGlite, migrated, then any stashed seed — all before the dispatcher
    // exists, so seeding always precedes the app's first query.
    const db = await applyPendingSeed(await freshTestDb(wotdSchema, migrations))
    return createDispatcher({
      router: createAppRouter(new FakeWordGenerator()),
      createContext: createContext({
        store: new DrizzleWotdStore(db),
        blobs: new InMemoryBlobStore(),
        // Fixed "today" so .iwft seeds (for_date = 2026-07-05) are deterministic.
        now: () => new Date('2026-07-05T00:00:00Z'),
        logger: new ConsoleLogger({ app: 'wotd', mode: 'iwft' }),
        auth: testUserAuth,
      }),
    })
  })(),
)

export function IwftApp() {
  return <App />
}
