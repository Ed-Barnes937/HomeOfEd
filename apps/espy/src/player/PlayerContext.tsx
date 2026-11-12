import type { FamilyTokenClaims } from '@hoe/accounts'
import { createContext, useContext, type ReactNode } from 'react'

/** Who the page opened for, read once at the app's entry. */
export interface Player {
  /** The family session; `null` when signed out, and always in the native shell. */
  session: FamilyTokenClaims | null
  /** Inside the Capacitor shell, which is outside the estate: no hub to switch player at. */
  native: boolean
}

const PlayerContext = createContext<Player>({ session: null, native: false })

interface PlayerProviderProps {
  player: Player
  children: ReactNode
}

export function PlayerProvider({ player, children }: PlayerProviderProps) {
  return <PlayerContext.Provider value={player}>{children}</PlayerContext.Provider>
}

/** The player this page opened for. Storage and the player-change watcher both follow it. */
export function usePlayer(): Player {
  return useContext(PlayerContext)
}
