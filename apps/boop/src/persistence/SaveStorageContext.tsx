import { createContext, useContext, type ReactNode } from 'react'

import type { SaveStorage } from './storage.ts'

const SaveStorageContext = createContext<SaveStorage | null>(null)

interface SaveStorageProviderProps {
  /** The playing profile's `profileStorage`, or the shared view's `memoryStorage`. */
  storage: SaveStorage
  children: ReactNode
}

export function SaveStorageProvider({ storage, children }: SaveStorageProviderProps) {
  return <SaveStorageContext.Provider value={storage}>{children}</SaveStorageContext.Provider>
}

/** Where boops and favourites are kept. Never `window.localStorage` directly, which is every profile's at once. */
export function useSaveStorage(): SaveStorage {
  const storage = useContext(SaveStorageContext)
  if (storage === null) throw new Error('useSaveStorage needs a SaveStorageProvider')
  return storage
}
