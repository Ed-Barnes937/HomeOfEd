import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { saveSummaryQuery } from '../../features/account/accountQueries.ts'
import { useFamilyClient } from '../../features/account/familyClient.tsx'
import { lastSavedLines } from '../../features/account/lastSaved.ts'

import styles from './AccountPage.module.scss'

const TICK_MS = 60_000

/** Quiet by design: nothing while loading, on a failed read, or with no saves. */
export function LastSaved({ accountId, name }: { accountId: string; name: string }) {
  const client = useFamilyClient()
  const summary = useQuery(saveSummaryQuery(client))
  const now = useNow()

  const lines = summary.data ? lastSavedLines(summary.data, accountId, now) : []
  if (lines.length === 0) return null
  return (
    <ul className={styles.saves} aria-label={`${name}'s last saves`}>
      {lines.map((line) => (
        <li key={line.appId}>{line.text}</li>
      ))}
    </ul>
  )
}

// A stalled sync must read as stale on a page left open, so the wording moves on.
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [])
  return now
}
