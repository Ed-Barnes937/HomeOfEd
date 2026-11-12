import { arrivalFragment, memoryStorage, profileStorage, reloadOnPlayerChange } from '@hoe/accounts'
import { Outlet, rootRouteId, useRouteContext } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { useFamilySession } from './familySession.tsx'
import type { ItemKind } from './items/item.ts'
import { PROFILE_KEYS } from './persistence/profileKeys.ts'
import { clearShareHash, decodeShareHash } from './share/shareLink.ts'
import { ShopPage } from './shop/ShopPage.tsx'
import type { ShopView } from './shop/shopView.ts'
import { wandShop } from './shop/wandShop.ts'
import { smithy } from './smithy/smithy.ts'
import { WorkbenchProvider } from './workbench/WorkbenchProvider.tsx'

/** The street, both shops and the shelf: the playing profile's counters and shelf (ADR 0094). */
export function PlayerView() {
  const player = useFamilySession()?.sub ?? null
  const { shared } = useRouteContext({ from: rootRouteId })
  const [storage] = useState(() => profileStorage(window.localStorage, player, PROFILE_KEYS))
  // Not on /shared: a reload there would throw away a visitor's unsaved edits.
  useEffect(() => reloadOnPlayerChange(player), [player])
  // The root's redirect drops a link's fragment itself; any other path clears it here.
  useEffect(() => {
    if (decodeShareHash(arrivalFragment())) clearShareHash(window.location, window.history)
  }, [])
  return (
    <WorkbenchProvider storage={storage} arrived={shared}>
      <Outlet />
    </WorkbenchProvider>
  )
}

const SHOPS: Record<ItemKind, ShopView> = { wand: wandShop, sword: smithy }

/** `/shared`: open to anyone, it keeps nothing, and its fragment stays so a reload reopens the share
 *  (ADR 0093 decision 6). */
export function SharedView() {
  const { shared } = useRouteContext({ from: rootRouteId })
  const [storage] = useState(memoryStorage)
  return (
    <WorkbenchProvider storage={storage} arrived={shared}>
      <ShopPage view={SHOPS[shared?.kind ?? 'wand']} shared />
    </WorkbenchProvider>
  )
}
