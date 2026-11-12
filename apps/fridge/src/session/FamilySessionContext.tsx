import type { FamilyTokenClaims } from '@hoe/accounts'
import { createContext, useContext, type ReactNode } from 'react'

const FamilySessionContext = createContext<FamilyTokenClaims | null>(null)

interface FamilySessionProviderProps {
  /** The family session the page opened with, read once at the app's entry; `null` when signed out. */
  session: FamilyTokenClaims | null
  children: ReactNode
}

export function FamilySessionProvider({ session, children }: FamilySessionProviderProps) {
  return <FamilySessionContext.Provider value={session}>{children}</FamilySessionContext.Provider>
}

/** The player this page opened for. The fridge's storage and the player watcher both follow it. */
export function useFamilySession(): FamilyTokenClaims | null {
  return useContext(FamilySessionContext)
}
