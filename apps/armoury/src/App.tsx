import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { lazy, useState } from 'react'

import './styles/tokens.scss'
import type { SaveStorage } from './persistence/storage.ts'
import { router } from './router.tsx'
import { StageContext, type Stages } from './stage/stage.ts'
import { WorkbenchProvider } from './workbench/WorkbenchProvider.tsx'

const wandStages: Stages = {
  Box: lazy(() => import('./stage/WandStage.tsx')),
  CloseUp: lazy(() => import('./stage/WandStage.tsx').then((m) => ({ default: m.CloseUpStage }))),
}

export function App({ stages = wandStages, storage }: { stages?: Stages; storage?: SaveStorage }) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <StageContext value={stages}>
        <WorkbenchProvider storage={storage}>
          <RouterProvider router={router} />
        </WorkbenchProvider>
      </StageContext>
    </QueryClientProvider>
  )
}
