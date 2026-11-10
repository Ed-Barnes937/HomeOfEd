import { arrivalFragment } from '@hoe/accounts'
import { useCallback, useState } from 'react'

import type { StoredWand } from '../persistence/saveFormat.ts'
import { encodeShare, keepFragment, keepSharedUrl } from './shareLink.ts'

/** `/shared`'s "Keep this wand": to the root and the gate, carrying `wand` as it is now. */
export function useKeepShared(wand: StoredWand): () => void {
  const [arrival] = useState(arrivalFragment)
  const [opened] = useState(() => encodeShare(wand))
  return useCallback(() => {
    const fragment = keepFragment(arrival, opened, encodeShare(wand))
    window.location.assign(keepSharedUrl(window.location.origin, fragment))
  }, [arrival, opened, wand])
}
