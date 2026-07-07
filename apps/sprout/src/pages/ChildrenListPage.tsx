// Ported from the source `routes/parent/children.tsx`.
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { PRESET_DEFINITIONS } from '@hoe/sprout-shared'

import { buttonVariants } from '../components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.tsx'
import { childrenQueryOptions } from '../features/children/childrenQueries.ts'
import { useRequireParent } from '../features/parentAuth/useRequireParent.ts'
import styles from './ChildrenListPage.module.scss'

export function ChildrenListPage() {
  const session = useRequireParent()
  const { data: kids, isLoading: loadingKids } = useQuery({
    ...childrenQueryOptions,
    enabled: Boolean(session.data),
  })

  if (session.isPending) {
    return (
      <div className={styles.loading}>
        <p className={styles.muted}>Loading...</p>
      </div>
    )
  }

  if (!session.data) return null

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Children</h1>
        <Link to="/parent/onboarding" className={buttonVariants({ size: 'sm' })}>
          Add child
        </Link>
      </div>

      <Link to="/parent/dashboard" className={styles.backLink}>
        Back to dashboard
      </Link>

      <div className={styles.list}>
        {loadingKids ? (
          <p className={styles.mutedSm}>Loading...</p>
        ) : !kids || kids.length === 0 ? (
          <Card>
            <CardContent className={styles.emptyContent}>
              <p className={styles.muted}>
                No children yet. Add your first child to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          kids.map((child) => (
            <Link
              key={child.id}
              to="/parent/children/$childId"
              params={{ childId: child.id }}
              className={styles.childLink}
            >
              <Card className={styles.childCard}>
                <CardHeader className={styles.cardHeaderTight}>
                  <CardTitle>{child.displayName}</CardTitle>
                  <CardDescription>
                    {PRESET_DEFINITIONS[child.presetName]?.label ?? child.presetName}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className={styles.mutedSm}>Tap to manage settings</p>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
