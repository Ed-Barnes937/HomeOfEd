// The one seam the account screens hang off: prod wires the real browser-direct
// client, the .iwft harness injects FakeFamilyClient (there is no live dev
// sign-in - Better Auth runs only in the family service's main.ts, ADR 0078).
import { createFamilyIdentityClient, type FamilyIdentityContract } from '@hoe/accounts'
import { createContext, use } from 'react'

import { familyUrl } from './familyService.ts'

const FamilyClientContext = createContext<FamilyIdentityContract | null>(null)

export const FamilyClientProvider = FamilyClientContext.Provider

export function useFamilyClient(): FamilyIdentityContract {
  const client = use(FamilyClientContext)
  if (client === null) throw new Error('no family client in context')
  return client
}

export function createDefaultFamilyClient(): FamilyIdentityContract {
  return createFamilyIdentityClient({
    baseUrl: familyUrl(window.location.hostname, window.location.port),
  })
}
