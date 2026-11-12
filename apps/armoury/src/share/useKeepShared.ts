import { arrivalFragment } from '@hoe/accounts'
import { useCallback, useState } from 'react'

import type { ItemKind, StoredItem } from '../items/item.ts'
import { encodeShare, keepFragment, keepSharedUrl } from './shareLink.ts'

/** `/shared`'s "Keep this": to the kind's shop and the gate, carrying `item` as it is now. */
export function useKeepShared(kind: ItemKind, item: StoredItem): () => void {
  const [arrival] = useState(arrivalFragment)
  const [opened] = useState(() => encodeShare(kind, item))
  return useCallback(() => {
    const fragment = keepFragment(arrival, opened, encodeShare(kind, item))
    window.location.assign(keepSharedUrl(window.location.origin, kind, fragment))
  }, [arrival, opened, kind, item])
}
