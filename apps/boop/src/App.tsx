import {
  bindSaveClient,
  createFamilySaveClient,
  readFamilySession,
  reloadOnPlayerChange,
  type FamilySaveContract,
} from '@hoe/accounts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import type { AudioDriver } from './engine/audioDriver.ts'
import { EngineProvider } from './engine/EngineContext.tsx'
import { ToneAudioDriver } from './engine/toneAudioDriver.ts'
import { router } from './router.tsx'
import { familyUrl } from './sync/familyUrl.ts'
import { keepaliveFetch } from './sync/keepaliveFetch.ts'
import { SaveClientProvider } from './sync/SaveClientContext.tsx'

interface AppProps {
  /** Overridden in `.iwft` with `FakeAudioDriver` so playback is assertable without real audio. */
  driver?: AudioDriver
  /** Overridden in `.iwft` with `FakeFamilyClient` (ADR 0080); bound to the page's profile like the real one. */
  saveClient?: FamilySaveContract
}

/**
 * The app owns the `AudioDriver`: one per page, for the life of the page. The
 * engine only borrows it (`SequencerEngine.dispose` leaves it alone), so a
 * dev double-mount can build a second engine over it without silencing the app.
 */
// One player per page (ADR 0080 as amended): the save client is bound to it, and another player reloads the page.
export function App({ driver, saveClient }: AppProps = {}) {
  const [queryClient] = useState(() => new QueryClient())
  const [audioDriver] = useState<AudioDriver>(() => driver ?? new ToneAudioDriver())
  const [player] = useState(() => readFamilySession()?.sub ?? null)
  const [familyClient] = useState<FamilySaveContract | null>(() => {
    if (player === null) return null
    if (saveClient) return bindSaveClient(saveClient, player)
    return createFamilySaveClient({
      baseUrl: familyUrl(window.location.hostname, window.location.port),
      accountId: player,
      fetch: keepaliveFetch,
    })
  })
  useEffect(() => reloadOnPlayerChange(player), [player])
  return (
    <QueryClientProvider client={queryClient}>
      <SaveClientProvider client={familyClient}>
        <EngineProvider driver={audioDriver}>
          <RouterProvider router={router} />
        </EngineProvider>
      </SaveClientProvider>
    </QueryClientProvider>
  )
}
