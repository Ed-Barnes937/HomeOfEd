import { createFamilySaveClient, readFamilySession, type FamilySaveContract } from '@hoe/accounts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useState } from 'react'

import type { AudioDriver } from './engine/audioDriver.ts'
import { EngineProvider } from './engine/EngineContext.tsx'
import { ToneAudioDriver } from './engine/toneAudioDriver.ts'
import { router } from './router.tsx'
import { FamilySessionProvider } from './sync/FamilySessionContext.tsx'
import { familyUrl } from './sync/familyUrl.ts'
import { keepaliveFetch } from './sync/keepaliveFetch.ts'
import { SaveClientProvider } from './sync/SaveClientContext.tsx'

interface AppProps {
  /** Overridden in `.iwft` with `FakeAudioDriver` so playback is assertable without real audio. */
  driver?: AudioDriver
  /** The save client bound to `accountId`; `.iwft` binds `FakeFamilyClient` with `bindSaveClient` (ADR 0080). */
  saveClientFor?: (accountId: string) => FamilySaveContract
}

function familySaveClientFor(accountId: string): FamilySaveContract {
  return createFamilySaveClient({
    baseUrl: familyUrl(window.location.hostname, window.location.port),
    accountId,
    fetch: keepaliveFetch,
  })
}

/**
 * The app owns the `AudioDriver`: one per page, for the life of the page. The
 * engine only borrows it (`SequencerEngine.dispose` leaves it alone), so a
 * dev double-mount can build a second engine over it without silencing the app.
 */
// One player per page (ADR 0080 as amended): the session is read once here, and storage, the bound
// save client and the player-change watcher all follow it.
export function App({ driver, saveClientFor = familySaveClientFor }: AppProps = {}) {
  const [queryClient] = useState(() => new QueryClient())
  const [audioDriver] = useState<AudioDriver>(() => driver ?? new ToneAudioDriver())
  const [session] = useState(() => readFamilySession())
  const [familyClient] = useState(() => (session === null ? null : saveClientFor(session.sub)))
  return (
    <QueryClientProvider client={queryClient}>
      <FamilySessionProvider session={session}>
        <SaveClientProvider client={familyClient}>
          <EngineProvider driver={audioDriver}>
            <RouterProvider router={router} />
          </EngineProvider>
        </SaveClientProvider>
      </FamilySessionProvider>
    </QueryClientProvider>
  )
}
