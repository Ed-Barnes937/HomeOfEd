// Ported from the source `routes/parent/dashboard.tsx`. Gating goes through the
// tRPC session probe (useRequireParent); the child list comes from
// `children.list` (no parentId — identity is server-side).
//
// Behaviour change (P4): the source showed "Welcome, {name}" from the Better
// Auth session. There is no tRPC `me` procedure yet (no new backend surface in
// P4), so the parent's display name is omitted until P5 mounts /api/auth/* or a
// session/me procedure lands.
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { PRESET_DEFINITIONS, type PresetName } from '@hoe/sprout-shared'
import { useMemo, useState } from 'react'

import { ChildSummaryPanel } from '../components/dashboard/ChildSummaryPanel.tsx'
import { ChildTabBar } from '../components/dashboard/ChildTabBar.tsx'
import { Button, buttonVariants } from '../components/ui/button.tsx'
import { Card, CardContent } from '../components/ui/card.tsx'
import { childrenQueryOptions } from '../features/children/childrenQueries.ts'
import { parentAuth } from '../features/parentAuth/parentAuth.ts'
import { useRequireParent } from '../features/parentAuth/useRequireParent.ts'

export function DashboardPage() {
  const navigate = useNavigate()
  const session = useRequireParent()
  const { data: kids, isLoading: loadingKids } = useQuery({
    ...childrenQueryOptions,
    enabled: Boolean(session.data),
  })
  const [userSelectedChildId, setUserSelectedChildId] = useState<string | null>(null)

  const activeChildId = useMemo(() => {
    if (!kids || kids.length === 0) return null
    const userPickIsValid = userSelectedChildId && kids.some((k) => k.id === userSelectedChildId)
    return userPickIsValid ? userSelectedChildId : (kids[0]?.id ?? null)
  }, [kids, userSelectedChildId])

  if (session.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!session.data) return null

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Parent Dashboard</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void parentAuth.signOut().finally(() => {
              void navigate({ to: '/' })
            })
          }
        >
          Log out
        </Button>
      </div>

      <p className="text-muted-foreground mt-2">Welcome back.</p>

      <div className="mt-6 flex items-center gap-2">
        <Link to="/parent/onboarding" className={buttonVariants({ size: 'sm' })}>
          Add child
        </Link>
        <Link to="/parent/flags" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          View flags
        </Link>
      </div>

      <div className="mt-8 space-y-4">
        {loadingKids ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : !kids || kids.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                No children yet. Add your first child to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <ChildTabBar
              children={kids}
              selectedChildId={activeChildId ?? kids[0]?.id ?? ''}
              onSelect={setUserSelectedChildId}
            />
            {activeChildId && (
              <div
                role="tabpanel"
                id={`tabpanel-${activeChildId}`}
                aria-labelledby={`tab-${activeChildId}`}
              >
                <ChildSummaryPanel
                  childId={activeChildId}
                  presetLabel={
                    PRESET_DEFINITIONS[
                      kids.find((k) => k.id === activeChildId)?.presetName as PresetName
                    ]?.label
                  }
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
