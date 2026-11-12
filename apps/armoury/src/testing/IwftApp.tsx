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
import { writeLastShop } from '../persistence/lastShop.ts'
import { appRouter } from '../server/router.ts'
import { failingStages, fakeStages } from './FakeStage.tsx'

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

/**
 * With `start`, the app opens as a visitor who was last in that kind's shop; with
 * `stagesFail`, every box stage fails to load.
 */
export function IwftApp({ start, stagesFail }: { start?: ItemKind; stagesFail?: boolean }) {
  useState(() => {
    if (start) writeLastShop(window.localStorage, start)
  })
  return <App stages={stagesFail ? failingStages : fakeStages} />
}
