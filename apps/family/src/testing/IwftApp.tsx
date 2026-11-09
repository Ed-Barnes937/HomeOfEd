// Browser side of the .iwft harness: the real backend over PGlite WASM, exposed
// for the page.route trampoline. Module init runs once per test page = fresh DB.
// No Better Auth and no minting here, both being node-only (ADR 0078).
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
