import { readFamilySession } from '@hoe/accounts'
import { useState } from 'react'

import { memoryStorage, profileStorage } from '../persistence/profileStorage.ts'
import { SaveStorageProvider } from '../persistence/SaveStorageContext.tsx'
import { SaveClientProvider } from '../sync/SaveClientContext.tsx'
import { HomePage } from './HomePage.tsx'

/** `/`: the playing profile's boops, synced when there is a family session (ADR 0094). */
export function PlayerView() {
  const [storage] = useState(() =>
    profileStorage(window.localStorage, readFamilySession()?.sub ?? null),
  )
  return (
    <SaveStorageProvider storage={storage}>
      <HomePage />
    </SaveStorageProvider>
  )
}

/** `/shared`: open to anyone, and it keeps and syncs nothing (ADR 0093 decision 6). */
export function SharedView() {
  const [storage] = useState(memoryStorage)
  return (
    <SaveClientProvider client={null}>
      <SaveStorageProvider storage={storage}>
        <HomePage shared />
      </SaveStorageProvider>
    </SaveClientProvider>
  )
}
