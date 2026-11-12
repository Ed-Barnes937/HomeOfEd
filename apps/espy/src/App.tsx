import { Capacitor } from '@capacitor/core'
import { readFamilySession } from '@hoe/accounts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useState } from 'react'

import { type Player, PlayerProvider } from './player/PlayerContext.tsx'
import { router } from './router.tsx'

interface AppProps {
  /** True inside the Capacitor shell; `.iwft` sets it to pin that the shell behaves as before profiles. */
  native?: boolean
}

// One player per page (ADR 0094): the session is read once here, and the doodle's storage and the
// player-change watcher follow it. The native shell has no family cookie and stays unscoped.
export function App({ native = Capacitor.isNativePlatform() }: AppProps = {}) {
  const [queryClient] = useState(() => new QueryClient())
  const [player] = useState<Player>(() => ({
    session: native ? null : readFamilySession(),
    native,
  }))
  return (
    <QueryClientProvider client={queryClient}>
      <PlayerProvider player={player}>
        <RouterProvider router={router} />
      </PlayerProvider>
    </QueryClientProvider>
  )
}
