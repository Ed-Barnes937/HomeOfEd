import { memoryStorage, profileStorage, reloadOnPlayerChange } from '@hoe/accounts'
import { Outlet } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { useFamilySession } from './familySession.tsx'
import { PROFILE_KEYS } from './persistence/profileKeys.ts'
import { ShopPage } from './shop/ShopPage.tsx'
import { WorkbenchProvider } from './workbench/WorkbenchProvider.tsx'

/** `/` and `/shelf`: the playing profile's counter and shelf (ADR 0094). */
export function PlayerView() {
  const player = useFamilySession()?.sub ?? null
  const [storage] = useState(() => profileStorage(window.localStorage, player, PROFILE_KEYS))
  // Not on /shared: a reload there would throw away a visitor's unsaved edits.
  useEffect(() => reloadOnPlayerChange(player), [player])
  return (
    <WorkbenchProvider storage={storage}>
      <Outlet />
    </WorkbenchProvider>
  )
}

/** `/shared`: open to anyone, and it keeps nothing (ADR 0093 decision 6). */
export function SharedView() {
  const [storage] = useState(memoryStorage)
  return (
    <WorkbenchProvider storage={storage} shared>
      <ShopPage shared />
    </WorkbenchProvider>
  )
}
