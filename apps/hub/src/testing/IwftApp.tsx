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
import type {
  IdentityMeOutput,
  ListChildrenOutput,
  MintSessionTokenInput,
  MintSessionTokenOutput,
} from '@hoe/accounts'
import { FakeFamilyClient } from '@hoe/accounts/testing/fake'
import { useEffect, useState } from 'react'

import { App } from '../App.tsx'
import { rememberProfile } from '../features/account/silentRenewal.ts'
import { migrations } from '../server/migrations.ts'
import { appRouter } from '../server/router.ts'
import { hubSchema } from '../server/schema.ts'
import { DrizzleHealthStore } from '../server/store.ts'

import {
  FAMILY_DOWN_KEY,
  FAMILY_HANGS_KEY,
  FAMILY_INVITE_CODE,
  FAMILY_SEED_KEY,
  type FamilySeed,
  FIXTURE_PARENT,
  type CountedFamilyCall,
  FAMILY_CALLS_KEY,
} from './familyFixture.ts'

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
const pageGlobals = globalThis as unknown as Record<string, unknown>
const calls: Record<CountedFamilyCall, number> = { me: 0, listChildren: 0, mintSessionToken: 0 }
pageGlobals[FAMILY_CALLS_KEY] = calls

// Counts calls, so a test can tell "nothing was minted" from "a mint was refused".
class HarnessFamilyClient extends FakeFamilyClient {
  hangs = false

  override me(): Promise<IdentityMeOutput> {
    calls.me += 1
    return this.hangs ? new Promise(() => undefined) : super.me()
  }

  override listChildren(): Promise<ListChildrenOutput> {
    calls.listChildren += 1
    return super.listChildren()
  }

  override mintSessionToken(input: MintSessionTokenInput): Promise<MintSessionTokenOutput> {
    calls.mintSessionToken += 1
    return super.mintSessionToken(input)
  }
}

const familyClient = new HarnessFamilyClient({
  inviteCode: FAMILY_INVITE_CODE,
  parents: [FIXTURE_PARENT],
  now: () => new ServiceDate(),
})
const seed = pageGlobals[FAMILY_SEED_KEY] as FamilySeed | undefined
const seeded = seed === undefined ? null : seedHousehold(seed).then(applyOutage)
if (seeded === null) applyOutage()

// After any seeding, which goes through the fake's own API.
function applyOutage(): void {
  if (pageGlobals[FAMILY_DOWN_KEY] === true) {
    familyClient.failWith(new Error('the family service is unreachable'))
  }
  familyClient.hangs = pageGlobals[FAMILY_HANGS_KEY] === true
}

// What a parent did on an earlier visit, through the fake's own API.
async function seedHousehold(seed: FamilySeed): Promise<void> {
  await familyClient.signIn({ email: FIXTURE_PARENT.email, password: FIXTURE_PARENT.password })
  const ids = new Map([[FIXTURE_PARENT.name, FIXTURE_PARENT.id]])
  for (const name of seed.profiles) {
    const profile = await familyClient.addChild({ displayName: name, username: name.toLowerCase() })
    ids.set(name, profile.id)
  }
  const remembered = ids.get(seed.remembered)!
  rememberProfile(remembered)
  if (seed.rememberedDeleted === true) await familyClient.deleteChild({ id: remembered })
  if (!seed.signedIn) await familyClient.signOut()
}

export function IwftApp() {
  const [ready, setReady] = useState(seeded === null)
  useEffect(() => {
    void seeded?.then(() => setReady(true))
  }, [])
  return ready ? <App familyClient={familyClient} /> : null
}
