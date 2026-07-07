import { useQuery } from '@tanstack/react-query'

import { childStatsQueryOptions } from '../../features/children/childrenQueries.ts'
import { cn } from '../../lib/utils.ts'
import { buttonVariants } from '../ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx'
import styles from './ChildSummaryPanel.module.scss'

interface ChildSummaryPanelProps {
  childId: string
  presetLabel?: string
}

function LoadingSkeleton() {
  return (
    <Card data-testid="child-summary-loading">
      <CardContent className={styles.loadingContent}>
        <div className={cn(styles.skeleton, styles.skeletonMd)} />
        <div className={cn(styles.skeleton, styles.skeletonLg)} />
        <div className={cn(styles.skeleton, styles.skeletonSm)} />
      </CardContent>
    </Card>
  )
}

function EmptyState({ presetLabel }: { presetLabel?: string }) {
  return (
    <Card>
      {presetLabel && (
        <CardHeader>
          <CardDescription>{presetLabel}</CardDescription>
        </CardHeader>
      )}
      <CardContent className={styles.emptyContent}>
        <p className={styles.emptyText}>
          No activity yet. This child hasn&apos;t started any conversations.
        </p>
      </CardContent>
    </Card>
  )
}

const pluralise = (count: number, singular: string, plural: string) =>
  count === 1 ? `${count} ${singular}` : `${count} ${plural}`

const formatLastActive = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export function ChildSummaryPanel({ childId, presetLabel }: ChildSummaryPanelProps) {
  const { data: stats, isLoading } = useQuery(childStatsQueryOptions(childId))

  if (isLoading) return <LoadingSkeleton />

  const hasActivity =
    stats && (stats.messageCount > 0 || stats.conversationCount > 0 || stats.flagCount > 0)

  if (!stats || !hasActivity) return <EmptyState presetLabel={presetLabel} />

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity summary</CardTitle>
        <CardDescription>
          {presetLabel && <span>{presetLabel}</span>}
          {presetLabel && stats.lastActive && <span> &middot; </span>}
          {stats.lastActive ? `Last active: ${formatLastActive(stats.lastActive)}` : null}
        </CardDescription>
      </CardHeader>
      <CardContent className={styles.content}>
        <div className={styles.statsGrid}>
          <div>
            <p className={styles.statLabel}>Messages</p>
            <p className={styles.statValue}>
              {pluralise(stats.messageCount, 'message', 'messages')}
            </p>
          </div>
          <div>
            <p className={styles.statLabel}>Conversations</p>
            <p className={styles.statValue}>
              {pluralise(stats.conversationCount, 'conversation', 'conversations')}
            </p>
          </div>
        </div>

        {stats.topTopics.length > 0 && (
          <div>
            <p className={styles.topicsLabel}>Topics</p>
            <div className={styles.topicList}>
              {stats.topTopics.map((topic) => (
                <span key={topic} className={styles.topicBadge}>
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className={styles.flagsRow}>
          <div>
            <p className={styles.statLabel}>Flags</p>
            <p className={styles.statValue}>
              {pluralise(stats.flagCount, 'unreviewed flag', 'unreviewed flags')}
            </p>
          </div>
          {stats.flagCount > 0 && (
            <a
              href={`/parent/flags?childId=${encodeURIComponent(childId)}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Review flags
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
