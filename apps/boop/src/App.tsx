import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useState } from 'react'

import type { AudioDriver } from './engine/audioDriver.ts'
import { EngineProvider } from './engine/EngineContext.tsx'
import { ToneAudioDriver } from './engine/toneAudioDriver.ts'
import { router } from './router.tsx'

interface AppProps {
  /** Overridden in `.iwft` with `FakeAudioDriver` so playback is assertable without real audio. */
  driver?: AudioDriver
}

export function App({ driver }: AppProps = {}) {
  const [queryClient] = useState(() => new QueryClient())
  const [audioDriver] = useState<AudioDriver>(() => driver ?? new ToneAudioDriver())
  return (
    <QueryClientProvider client={queryClient}>
      <EngineProvider driver={audioDriver}>
        <RouterProvider router={router} />
      </EngineProvider>
    </QueryClientProvider>
  )
}
