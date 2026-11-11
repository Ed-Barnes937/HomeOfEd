import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { lazy, useState } from 'react'

import './styles/tokens.scss'
import type { SaveStorage } from './persistence/storage.ts'
import { router } from './router.tsx'
import { StageContext, type StagesByKind } from './stage/stage.ts'
import { useShops, WorkbenchProvider } from './workbench/WorkbenchProvider.tsx'

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

function Routes() {
  const { landing } = useShops()
  return <RouterProvider router={router} context={{ landing }} />
}

export function App({
  stages = realStages,
  storage,
}: {
  stages?: StagesByKind
  storage?: SaveStorage
}) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <StageContext value={stages}>
        <WorkbenchProvider storage={storage}>
          <Routes />
        </WorkbenchProvider>
      </StageContext>
    </QueryClientProvider>
  )
}
