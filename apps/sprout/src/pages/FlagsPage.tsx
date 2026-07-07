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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
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
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Flagged Conversations</h1>
        <Link to="/parent/dashboard" className="text-sm text-blue-600 hover:underline">
          Back to dashboard
        </Link>
      </div>

      <p className="text-muted-foreground mt-2 text-sm">
        A record of what the safety checks flagged — and whether each reply was blocked before your
        child saw it or shown to them.
      </p>

      <div
        data-testid="safety-disclosure"
        className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      >
        <p className="font-medium">What this can and can&apos;t do</p>
        <p className="mt-1">
          No safety system is perfect. These guardrails lower the risk of unsafe or inappropriate
          content — they don&apos;t remove it. Treat this log as a record to review, not a
          guarantee, and stay involved in your child&apos;s conversations.
        </p>
      </div>

      <div className="mt-4">
        <label htmlFor="child-filter" className="sr-only">
          Filter by child
        </label>
        <select
          id="child-filter"
          data-testid="child-filter"
          className="border-input bg-background rounded-md border px-3 py-2 text-sm"
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

      <div className="mt-6 space-y-3">
        {loadingFlags ? (
          <p className="text-muted-foreground text-sm">Loading flags...</p>
        ) : flagsError ? (
          <div className="py-8 text-center">
            <p className="text-destructive text-sm" data-testid="error-state">
              Couldn&apos;t load flagged conversations. Please try again.
            </p>
          </div>
        ) : !flags || flags.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground" data-testid="empty-state">
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
                className="block"
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
