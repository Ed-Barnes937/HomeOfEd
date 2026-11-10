import { readFamilySession } from '@hoe/accounts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useState } from 'react'

import { FamilySessionProvider } from './features/player/FamilySessionContext.tsx'
import { router } from './router.tsx'

export function App() {
  const [queryClient] = useState(() => new QueryClient())
  // Read once, so the presets and the player-change watcher can never disagree.
  const [session] = useState(() => readFamilySession())
  return (
    <QueryClientProvider client={queryClient}>
      <FamilySessionProvider session={session}>
        <RouterProvider router={router} />
      </FamilySessionProvider>
    </QueryClientProvider>
  )
}
