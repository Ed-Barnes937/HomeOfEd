import { readFamilySession } from '@hoe/accounts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useState } from 'react'

import { FamilySessionProvider } from './features/family/FamilySessionContext.tsx'
import { router } from './router.tsx'

// One player per page (ADR 0094): the session is read once here, and storage and the
// player-change watcher both follow it.
export function App() {
  const [queryClient] = useState(() => new QueryClient())
  const [session] = useState(() => readFamilySession())
  return (
    <QueryClientProvider client={queryClient}>
      <FamilySessionProvider session={session}>
        <RouterProvider router={router} />
      </FamilySessionProvider>
    </QueryClientProvider>
  )
}
