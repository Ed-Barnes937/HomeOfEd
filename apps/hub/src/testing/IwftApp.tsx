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
import { FakeFamilyClient } from '@hoe/accounts/testing/fake'

import { App } from '../App.tsx'
import { migrations } from '../server/migrations.ts'
import { appRouter } from '../server/router.ts'
import { hubSchema } from '../server/schema.ts'
import { DrizzleHealthStore } from '../server/store.ts'

import { FAMILY_DOWN_KEY, FAMILY_INVITE_CODE, FIXTURE_PARENT } from './familyFixture.ts'

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

// The family service is a separate origin with its own backend, so the tRPC
// trampoline cannot serve it. One fake per page, signed out, holding the one
// household a test can sign into.
// The service keeps its own clock, so a test can move the device's (page.clock).
const ServiceDate = Date
const familyClient = new FakeFamilyClient({
  inviteCode: FAMILY_INVITE_CODE,
  parents: [FIXTURE_PARENT],
  now: () => new ServiceDate(),
})
if ((globalThis as unknown as Record<string, unknown>)[FAMILY_DOWN_KEY] === true) {
  familyClient.failWith(new Error('the family service is unreachable'))
}

export function IwftApp() {
  return <App familyClient={familyClient} />
}
