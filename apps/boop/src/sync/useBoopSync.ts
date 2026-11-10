import { readFamilySession } from '@hoe/accounts'
import { useEffect, useState } from 'react'

import { useSaveStorage } from '../persistence/SaveStorageContext.tsx'
import { createBoopSync } from './boopSync.ts'
import { useSaveClient } from './SaveClientContext.tsx'

/**
 * Longer than the autosave's 2s lull, so what gets copied up is a document the
 * autosave has already finished writing.
 */
const SYNC_WATCH_MS = 5_000

export interface BoopSyncState {
  /** The profile name for the chip, or `null` when nothing is synced. */
  syncedAs: string | null
}

/**
 * boop's half of the family SaveStore (ADR 0080, as amended): a signed-in
 * profile always syncs - the pull at start, then the watcher that copies the
 * document up after a change. With no family session, or no client (the shared
 * view), it does nothing at all - no timers, no listeners, no requests.
 */
export function useBoopSync(): BoopSyncState {
  const client = useSaveClient()
  const storage = useSaveStorage()
  // Read once: a cookie appearing mid-session is a page the child will reload
  // anyway, and re-reading per render would restart the pull.
  const [session] = useState(() => readFamilySession())
  const syncing = client !== null && session !== null

  useEffect(() => {
    if (!client || !session) return
    const push = () => void sync.pushIfChanged()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') push()
    }
    const unwatch = () => {
      clearInterval(timer)
      window.removeEventListener('pagehide', push)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    // The client is bound to this page's profile, so another profile signing in stops the watcher.
    const sync = createBoopSync({ client, storage, onStop: unwatch })
    void sync.reconcile()
    const timer = setInterval(push, SYNC_WATCH_MS)
    // Registered after `useWorkingSong`'s own pagehide flush, so by the time
    // this one runs the pending autosave is already on disk.
    window.addEventListener('pagehide', push)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return unwatch
  }, [client, session, storage])

  return { syncedAs: syncing ? session.name : null }
}
