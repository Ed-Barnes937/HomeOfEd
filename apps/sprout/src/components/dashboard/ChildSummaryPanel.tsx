// Ported from the source (behaviour/markup). Tailwind classes retained; SCSS is P7.
import { useQuery } from '@tanstack/react-query'

import { childStatsQueryOptions } from '../../features/children/childrenQueries.ts'
import { buttonVariants } from '../ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx'

interface ChildSummaryPanelProps {
  childId: string
  presetLabel?: string
}

function LoadingSkeleton() {
  return (
    <Card data-testid="child-summary-loading">
      <CardContent className="space-y-4 py-6">
        <div className="bg-muted h-4 w-32 animate-pulse rounded" />
        <div className="bg-muted h-4 w-48 animate-pulse rounded" />
        <div className="bg-muted h-4 w-24 animate-pulse rounded" />
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
      <CardContent className="py-8 text-center">
        <p className="text-muted-foreground">
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
        <CardTitle className="text-base">Activity summary</CardTitle>
        <CardDescription>
          {presetLabel && <span>{presetLabel}</span>}
          {presetLabel && stats.lastActive && <span> &middot; </span>}
          {stats.lastActive ? `Last active: ${formatLastActive(stats.lastActive)}` : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-muted-foreground text-sm">Messages</p>
            <p className="text-lg font-semibold">
              {pluralise(stats.messageCount, 'message', 'messages')}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Conversations</p>
            <p className="text-lg font-semibold">
              {pluralise(stats.conversationCount, 'conversation', 'conversations')}
            </p>
          </div>
        </div>

        {stats.topTopics.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-2 text-sm">Topics</p>
            <div className="flex flex-wrap gap-1.5">
              {stats.topTopics.map((topic) => (
                <span
                  key={topic}
                  className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-0.5 text-xs"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm">Flags</p>
            <p className="text-lg font-semibold">
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
