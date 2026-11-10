import { profileStorage, reloadOnPlayerChange, type StorageLike } from '@hoe/accounts'
import { useEffect, useState } from 'react'

import { useFamilySession } from '../features/family/FamilySessionContext.tsx'
import { PROFILE_KEYS } from '../features/family/profileKeys.ts'
import { HomePage } from './HomePage.tsx'

/** Private browsing modes can make even *touching* localStorage throw. */
function openPlayerStorage(player: string | null): StorageLike | null {
  try {
    return profileStorage(window.localStorage, player, PROFILE_KEYS)
  } catch {
    return null
  }
}

/** `/`: the playing profile's scenes and field notes (ADR 0094). */
export function PlayerView() {
  const player = useFamilySession()?.sub ?? null
  const [storage] = useState(() => openPlayerStorage(player))
  useEffect(() => reloadOnPlayerChange(player), [player])
  return <HomePage storage={storage} />
}
