// Browser side of the .iwft harness: pull the real backend (router + handlers +
// PGlite WASM) into the CT bundle and expose its dispatcher for the page.route
// trampoline. Module init runs once per test page = fresh DB per test.
//
// Two deliberate gaps, both because the harness is a browser: Better Auth never
// runs here, and token minting throws (node:crypto). Family's own .iwft drives
// the placeholder page; the identity flows are hub's, over FakeFamilyClient.
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
import { createAppRouter } from '../server/router.ts'
import { familySchema } from '../server/schema.ts'
import { DrizzleFamilyStore } from '../server/store.ts'

exposeDispatcher(
  (async () => {
    const db = await applyPendingSeed(await freshTestDb(familySchema, migrations))
    return createDispatcher({
      router: createAppRouter({
        mintToken: () => {
          throw new Error('family: token minting needs node:crypto, so not in the .iwft harness')
        },
      }),
      createContext: createContext({
        store: new DrizzleFamilyStore(db),
        blobs: new InMemoryBlobStore(),
        logger: new ConsoleLogger({ app: 'family', mode: 'iwft' }),
        auth: testUserAuth,
      }),
    })
  })(),
)

export function IwftApp() {
  return <App />
}
