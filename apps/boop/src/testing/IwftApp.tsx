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
import { FakeAudioDriver } from '../engine/testing/fakeAudioDriver.ts'
import { appRouter } from '../server/router.ts'
import { BOOP_AUDIO_DRIVER_KEY } from './gridProtocol.ts'

exposeDispatcher(
  createDispatcher({
    router: appRouter,
    createContext: createContext<void>({
      store: undefined,
      blobs: new InMemoryBlobStore(),
      logger: new ConsoleLogger({ app: 'boop', mode: 'iwft' }),
      auth: testUserAuth,
    }),
  }),
)

// The fake audio driver, hand-cranked from the Node side of the test via
// `page.evaluate` — see BOOP_AUDIO_DRIVER_KEY in gridProtocol.ts. Fakes over
// mocks: the same FakeAudioDriver the engine's own unit tests run against.
const audioDriver = new FakeAudioDriver()
;(globalThis as unknown as Record<string, unknown>)[BOOP_AUDIO_DRIVER_KEY] = audioDriver

export function IwftApp() {
  return <App driver={audioDriver} />
}
