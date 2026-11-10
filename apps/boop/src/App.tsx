import { createFamilySaveClient, type FamilySaveContract } from '@hoe/accounts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useState } from 'react'

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
  /** Overridden in `.iwft` with `FakeFamilyClient` (ADR 0080). */
  saveClient?: FamilySaveContract
}

/**
 * The app owns the `AudioDriver`: one per page, for the life of the page. The
 * engine only borrows it (`SequencerEngine.dispose` leaves it alone), so a
 * dev double-mount can build a second engine over it without silencing the app.
 *
 * It owns the family save client the same way. Building it opens no connection
 * and reads no cookie - whether anything is ever sent is `useBoopSync`'s call.
 */
export function App({ driver, saveClient }: AppProps = {}) {
  const [queryClient] = useState(() => new QueryClient())
  const [audioDriver] = useState<AudioDriver>(() => driver ?? new ToneAudioDriver())
  const [familyClient] = useState<FamilySaveContract>(
    () =>
      saveClient ??
      createFamilySaveClient({
        baseUrl: familyUrl(window.location.hostname, window.location.port),
        fetch: keepaliveFetch,
      }),
  )
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
