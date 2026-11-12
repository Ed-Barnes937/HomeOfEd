import { profileStorage, reloadOnPlayerChange } from '@hoe/accounts'
import { Outlet } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { BoardStorageProvider } from '../features/board/BoardStorageContext.tsx'
import { PROFILE_KEYS } from '../features/board/profileKeys.ts'
import { useFamilySession } from '../session/FamilySessionContext.tsx'

/** `/` and `/keep/$id`: the playing profile's fridge (ADR 0094). */
export function PlayerLayout() {
  const player = useFamilySession()?.sub ?? null
  const [storage] = useState(() => profileStorage(window.localStorage, player, PROFILE_KEYS))
  // Not on /b: a reload there would throw away a visitor's unsaved edits.
  useEffect(() => reloadOnPlayerChange(player), [player])
  return (
    <BoardStorageProvider storage={storage}>
      <Outlet />
    </BoardStorageProvider>
  )
}
