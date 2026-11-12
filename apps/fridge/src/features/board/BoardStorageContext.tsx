import { createContext, useContext, type ReactNode } from 'react'

import type { BoardStorage } from './serialize.ts'

const BoardStorageContext = createContext<BoardStorage | null>(null)

interface BoardStorageProviderProps {
  /** The player's `profileStorage`, or a shared fridge's `memoryStorage`. */
  storage: BoardStorage
  children: ReactNode
}

export function BoardStorageProvider({ storage, children }: BoardStorageProviderProps) {
  return <BoardStorageContext.Provider value={storage}>{children}</BoardStorageContext.Provider>
}

/** Where the fridge is kept. Never `window.localStorage` directly, which is every player's at once. */
export function useBoardStorage(): BoardStorage {
  const storage = useContext(BoardStorageContext)
  if (storage === null) throw new Error('useBoardStorage needs a BoardStorageProvider')
  return storage
}
