import { arrivalFragment, readFamilySession } from '@hoe/accounts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { lazy, useState } from 'react'

import './styles/tokens.scss'
import { FamilySessionProvider } from './familySession.tsx'
import { readLastShop } from './persistence/lastShop.ts'
import { router, type Arrival } from './router.tsx'
import { decodeShareHash } from './share/shareLink.ts'
import { StageContext, type StagesByKind } from './stage/stage.ts'

const realStages: StagesByKind = {
  wand: {
    Box: lazy(() => import('./stage/WandStage.tsx')),
    CloseUp: lazy(() => import('./stage/WandStage.tsx').then((m) => ({ default: m.CloseUpStage }))),
  },
  sword: {
    Box: lazy(() => import('./stage/SwordStage.tsx')),
    CloseUp: lazy(() =>
      import('./stage/SwordStage.tsx').then((m) => ({ default: m.SwordCloseUpStage })),
    ),
  },
}

// Read before the router mounts, as the root's redirect drops the fragment. The last shop is a
// device preference, so this only reads it.
function arrive(): Arrival {
  const shared = decodeShareHash(arrivalFragment())
  return {
    shared,
    landing: { arrivalKind: shared?.kind ?? null, lastShop: readLastShop(window.localStorage) },
  }
}

// One player per page (ADR 0094): the session is read once here, and storage, the chip and the
// player-change watcher all follow it.
export function App({ stages = realStages }: { stages?: StagesByKind }) {
  const [queryClient] = useState(() => new QueryClient())
  const [session] = useState(() => readFamilySession())
  const [arrival] = useState(arrive)
  return (
    <QueryClientProvider client={queryClient}>
      <FamilySessionProvider session={session}>
        <StageContext value={stages}>
          <RouterProvider router={router} context={arrival} />
        </StageContext>
      </FamilySessionProvider>
    </QueryClientProvider>
  )
}
