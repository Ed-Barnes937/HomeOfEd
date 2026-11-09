import { readFamilySession } from '@hoe/accounts'
import { useCallback, useEffect, useRef, useState } from 'react'

import { createBoopSync, type BoopSync } from './boopSync.ts'
import { useSaveClient } from './SaveClientContext.tsx'
import { readSyncAnswer, recordSyncAnswer } from './syncedAccount.ts'

/**
 * Longer than the autosave's 2s lull, so what gets copied up is a document the
 * autosave has already finished writing.
 */
const SYNC_WATCH_MS = 5_000

export interface BoopSyncState {
  /** The profile name for the chip, or `null` when nothing is linked. */
  syncedAs: string | null
  /** The profile the first-link offer is for, or `null` when it is not up. */
  offering: string | null
  acceptImport: () => void
  declineImport: () => void
}

/**
 * boop's half of the family SaveStore (ADR 0080): the pull at start, the
 * first-link offer, and the watcher that copies the document up after a change.
 * With no family session it does nothing at all - no timers, no listeners, no
 * requests.
 */
export function useBoopSync(): BoopSyncState {
  const client = useSaveClient()
  // Read once: a cookie appearing mid-session is a page the child will reload
  // anyway, and re-reading per render would restart the pull.
  const [session] = useState(() => readFamilySession())
  const [offering, setOffering] = useState(false)
  const [linked, setLinked] = useState(false)
  const sync = useRef<BoopSync | null>(null)

  useEffect(() => {
    if (!client || !session) return
    const answer = readSyncAnswer(window.localStorage, session.sub)
    // A declined account gets nothing: no pull, no push, no watcher, and no
    // second offer. Nothing is built here that could make a call.
    if (answer === 'declined') return
    const boopSync = createBoopSync({ client, storage: window.localStorage })
    sync.current = boopSync
    if (answer === null) {
      setOffering(true)
      return
    }
    setLinked(true)
    void boopSync.reconcile()
    // A dev double-mount builds a second sync over the same storage; the first
    // must not stay reachable from the ref.
    return () => {
      if (sync.current === boopSync) sync.current = null
    }
  }, [client, session])

  useEffect(() => {
    if (!linked) return
    const push = () => void sync.current?.pushIfChanged()
    const timer = setInterval(push, SYNC_WATCH_MS)
    // Registered after `useWorkingSong`'s own pagehide flush, so by the time
    // this one runs the pending autosave is already on disk.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') push()
    }
    window.addEventListener('pagehide', push)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearInterval(timer)
      window.removeEventListener('pagehide', push)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [linked])

  const acceptImport = useCallback(() => {
    if (!session) return
    setOffering(false)
    recordSyncAnswer(window.localStorage, session.sub, 'accepted')
    setLinked(true)
    void sync.current?.reconcile()
  }, [session])

  // No pull, no push, and nothing linked - now or on any later start, until
  // the answer itself is changed. "Not now" has to mean what it says.
  const declineImport = useCallback(() => {
    if (!session) return
    setOffering(false)
    recordSyncAnswer(window.localStorage, session.sub, 'declined')
    sync.current = null
  }, [session])

  return {
    syncedAs: linked && session ? session.name : null,
    offering: offering && session ? session.name : null,
    acceptImport,
    declineImport,
  }
}
