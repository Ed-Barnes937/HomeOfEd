import { useQuery } from '@tanstack/react-query'

import { FAMILY_STALE_MS, familyQueryKeys } from '../../features/account/accountQueries.ts'
import { useFamilyClient } from '../../features/account/familyClient.tsx'
import { lastSavedLines } from '../../features/account/lastSaved.ts'

import styles from './AccountPage.module.scss'

/** Quiet by design: nothing while loading, on a failed read, or with no saves. */
export function LastSaved({ accountId, name }: { accountId: string; name: string }) {
  const client = useFamilyClient()
  const summary = useQuery({
    queryKey: familyQueryKeys.saveSummary,
    queryFn: () => client.saveSummary(),
    staleTime: FAMILY_STALE_MS,
  })

  const lines = summary.data ? lastSavedLines(summary.data, accountId, Date.now()) : []
  if (lines.length === 0) return null
  return (
    <ul className={styles.saves} aria-label={`${name}'s last saves`}>
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}
