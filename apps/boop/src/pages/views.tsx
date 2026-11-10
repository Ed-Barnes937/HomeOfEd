import { memoryStorage, profileStorage, reloadOnPlayerChange } from '@hoe/accounts'
import { useEffect, useState } from 'react'

import { PROFILE_KEYS } from '../persistence/profileKeys.ts'
import { SaveStorageProvider } from '../persistence/SaveStorageContext.tsx'
import { useFamilySession } from '../sync/FamilySessionContext.tsx'
import { SaveClientProvider } from '../sync/SaveClientContext.tsx'
import { HomePage } from './HomePage.tsx'

/** `/`: the playing profile's boops, synced when there is a family session (ADR 0094). */
export function PlayerView() {
  const player = useFamilySession()?.sub ?? null
  const [storage] = useState(() => profileStorage(window.localStorage, player, PROFILE_KEYS))
  // Not on /shared: a reload there would throw away a visitor's unsaved edits.
  useEffect(() => reloadOnPlayerChange(player), [player])
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
