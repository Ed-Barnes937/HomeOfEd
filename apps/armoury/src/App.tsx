import { readFamilySession } from '@hoe/accounts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { lazy, useState } from 'react'

import './styles/tokens.scss'
import { FamilySessionProvider } from './familySession.tsx'
import { router } from './router.tsx'
import { StageContext, type Stages } from './stage/stage.ts'

const wandStages: Stages = {
  Box: lazy(() => import('./stage/WandStage.tsx')),
  CloseUp: lazy(() => import('./stage/WandStage.tsx').then((m) => ({ default: m.CloseUpStage }))),
}

// One player per page (ADR 0094): the session is read once here, and storage, the chip and the
// player-change watcher all follow it.
export function App({ stages = wandStages }: { stages?: Stages }) {
  const [queryClient] = useState(() => new QueryClient())
  const [session] = useState(() => readFamilySession())
  return (
    <QueryClientProvider client={queryClient}>
      <FamilySessionProvider session={session}>
        <StageContext value={stages}>
          <RouterProvider router={router} />
        </StageContext>
      </FamilySessionProvider>
    </QueryClientProvider>
  )
}
