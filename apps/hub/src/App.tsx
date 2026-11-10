import type { FamilyIdentityContract } from '@hoe/accounts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useState } from 'react'

import {
  createDefaultFamilyClient,
  FamilyClientProvider,
} from './features/account/familyClient.tsx'
import { router } from './router.tsx'

export interface AppProps {
  /** The .iwft harness injects FakeFamilyClient here; prod builds the real one. */
  familyClient?: FamilyIdentityContract
}

export function App({ familyClient }: AppProps = {}) {
  const [queryClient] = useState(() => new QueryClient())
  const [client] = useState(() => familyClient ?? createDefaultFamilyClient())
  return (
    <QueryClientProvider client={queryClient}>
      <FamilyClientProvider value={client}>
        <RouterProvider router={router} />
      </FamilyClientProvider>
    </QueryClientProvider>
  )
}
