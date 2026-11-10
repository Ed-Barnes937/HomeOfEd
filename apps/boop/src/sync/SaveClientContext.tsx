import type { FamilySaveContract } from '@hoe/accounts'
import { createContext, useContext, type ReactNode } from 'react'

const SaveClientContext = createContext<FamilySaveContract | null>(null)

interface SaveClientProviderProps {
  /** The family save client - the real one in prod, `FakeFamilyClient` in .iwft. */
  client: FamilySaveContract | null
  children: ReactNode
}

export function SaveClientProvider({ client, children }: SaveClientProviderProps) {
  return <SaveClientContext.Provider value={client}>{children}</SaveClientContext.Provider>
}

/** The save client, or `null` when boop is running without one at all. */
export function useSaveClient(): FamilySaveContract | null {
  return useContext(SaveClientContext)
}
