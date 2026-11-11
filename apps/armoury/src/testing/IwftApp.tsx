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

import { useState } from 'react'

import { App } from '../App.tsx'
import type { ItemKind } from '../items/item.ts'
import { router } from '../router.tsx'
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

const SHOP_PATHS: Record<ItemKind, string> = { wand: '/', sword: '/swords' }

/** With `start`, the app opens in that kind's shop, keeping any share fragment. */
export function IwftApp({ start }: { start?: ItemKind }) {
  useState(() => {
    if (!start) return
    router.history.replace(`${SHOP_PATHS[start]}${window.location.hash}`)
    // Written now, not on the next microtask, so the provider's own fragment clearing comes after.
    router.history.flush()
  })
  return <App stages={fakeStages} />
}
