// Ported from the source `routes/parent/flags.tsx`. `flags.list` returns the
// parent's whole owned-flag set (server ignores childId — #35); the per-child
// filter is applied client-side here.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { ChangeEvent } from 'react'
import { useState } from 'react'

import { FlagListItem } from '../components/dashboard/FlagListItem.tsx'
import { childrenQueryOptions } from '../features/children/childrenQueries.ts'
import { flagsQueryOptions, reviewFlag } from '../features/flags/flagsQueries.ts'
import { useRequireParent } from '../features/parentAuth/useRequireParent.ts'
import styles from './FlagsPage.module.scss'

export function FlagsPage() {
  const queryClient = useQueryClient()
  const session = useRequireParent()
  const [selectedChildId, setSelectedChildId] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') return undefined
    return new URLSearchParams(window.location.search).get('childId') ?? undefined
  })

  const {
    data: allFlags,
    isLoading: loadingFlags,
    isError: flagsError,
  } = useQuery({ ...flagsQueryOptions, enabled: Boolean(session.data) })
  const { data: children } = useQuery({ ...childrenQueryOptions, enabled: Boolean(session.data) })

  const markReviewed = useMutation({
    mutationFn: (flagId: string) => reviewFlag(flagId, true),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['flags'] }),
  })

  if (session.isPending) {
    return (
      <div className={styles.loading}>
        <p className={styles.mutedText}>Loading...</p>
      </div>
    )
  }

  if (!session.data) return null

  const flags = selectedChildId
    ? (allFlags ?? []).filter((f) => f.childId === selectedChildId)
    : allFlags

  const handleFilterChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setSelectedChildId(value || undefined)
    const url = new URL(window.location.href)
    if (value) {
      url.searchParams.set('childId', value)
    } else {
      url.searchParams.delete('childId')
    }
    window.history.replaceState({}, '', url.toString())
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1 className={styles.heading}>Flagged Conversations</h1>
        <Link to="/parent/dashboard" className={styles.backLink}>
          Back to dashboard
        </Link>
      </div>

      <p className={styles.intro}>
        A record of what the safety checks flagged — and whether each reply was blocked before your
        child saw it or shown to them.
      </p>

      <div data-testid="safety-disclosure" className={styles.disclosure}>
        <p className={styles.disclosureTitle}>What this can and can&apos;t do</p>
        <p className={styles.disclosureBody}>
          No safety system is perfect. These guardrails lower the risk of unsafe or inappropriate
          content — they don&apos;t remove it. Treat this log as a record to review, not a
          guarantee, and stay involved in your child&apos;s conversations.
        </p>
      </div>

      <div className={styles.filterWrap}>
        <label htmlFor="child-filter" className={styles.srOnly}>
          Filter by child
        </label>
        <select
          id="child-filter"
          data-testid="child-filter"
          className={styles.select}
          value={selectedChildId ?? ''}
          onChange={handleFilterChange}
        >
          <option value="">All children</option>
          {children?.map((child) => (
            <option key={child.id} value={child.id}>
              {child.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.flagList}>
        {loadingFlags ? (
          <p className={styles.mutedTextSm}>Loading flags...</p>
        ) : flagsError ? (
          <div className={styles.emptyState}>
            <p className={styles.errorText} data-testid="error-state">
              Couldn&apos;t load flagged conversations. Please try again.
            </p>
          </div>
        ) : !flags || flags.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.mutedText} data-testid="empty-state">
              No flagged conversations found.
            </p>
          </div>
        ) : (
          flags.map((flag) =>
            flag.conversationId ? (
              <Link
                key={flag.id}
                to="/parent/conversations/$conversationId"
                params={{ conversationId: flag.conversationId }}
                className={styles.blockLink}
                data-testid="flag-link"
              >
                <FlagListItem flag={flag} onMarkReviewed={(id) => markReviewed.mutate(id)} />
              </Link>
            ) : (
              <div key={flag.id} data-testid="flag-link">
                <FlagListItem flag={flag} onMarkReviewed={(id) => markReviewed.mutate(id)} />
              </div>
            ),
          )
        )}
      </div>
    </div>
  )
}
