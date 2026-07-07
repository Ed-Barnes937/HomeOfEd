import type { MouseEvent } from 'react'

import type { FlagSummary } from '../../features/flags/flagsQueries.ts'
import { cn } from '../../lib/utils.ts'
import { Button } from '../ui/button.tsx'
import { Card, CardContent } from '../ui/card.tsx'
import styles from './FlagListItem.module.scss'

const FLAG_TYPE_STYLES: Record<FlagSummary['type'], { label: string; className: string }> = {
  sensitive: { label: 'Sensitive', className: cn(styles.badgeSensitive) },
  blocked: { label: 'Blocked', className: cn(styles.badgeBlocked) },
  'validation-failed': { label: 'Validation Failed', className: cn(styles.badgeValidationFailed) },
  reported: { label: 'Reported', className: cn(styles.badgeReported) },
}

/**
 * Safe-by-default visibility (6.5.9): tell the parent plainly whether the
 * flagged reply reached the child or was held back, derived from the flag type.
 */
const FLAG_OUTCOMES: Record<FlagSummary['type'], { label: string; reachedChild: boolean }> = {
  blocked: { label: 'Blocked before your child saw it', reachedChild: false },
  'validation-failed': { label: 'Blocked before your child saw it', reachedChild: false },
  sensitive: { label: 'Shown to your child', reachedChild: true },
  reported: { label: 'Shown to your child', reachedChild: true },
}

interface FlagListItemProps {
  flag: FlagSummary
  onMarkReviewed: (flagId: string) => void
}

function parseTopics(topics: string | null): string[] {
  if (!topics) return []
  try {
    return JSON.parse(topics) as string[]
  } catch {
    return []
  }
}

export function FlagListItem({ flag, onMarkReviewed }: FlagListItemProps) {
  const typeStyle = FLAG_TYPE_STYLES[flag.type] ?? {
    label: flag.type,
    className: styles.badgeDefault,
  }
  const outcome = FLAG_OUTCOMES[flag.type]
  const parsedTopics = parseTopics(flag.topics)

  return (
    <Card data-testid="flag-item">
      <CardContent className={styles.content}>
        <div className={styles.row}>
          <div className={styles.main}>
            <div className={styles.headerLine}>
              <span className={styles.childName}>{flag.childDisplayName}</span>
              <span data-testid="flag-type-badge" className={cn(styles.badge, typeStyle.className)}>
                {typeStyle.label}
              </span>
              <span className={styles.timestamp}>
                {new Date(flag.createdAt).toLocaleString()}
              </span>
            </div>

            <p className={styles.reason}>{flag.reason}</p>

            {outcome && (
              <p
                data-testid="flag-outcome"
                className={cn(
                  styles.outcome,
                  outcome.reachedChild ? styles.outcomeReached : styles.outcomeBlocked,
                )}
              >
                {outcome.reachedChild ? '⚠ ' : '✓ '}
                {outcome.label}
              </p>
            )}

            {parsedTopics.length > 0 && (
              <div className={styles.topicList}>
                {parsedTopics.map((topic) => (
                  <span key={topic} data-testid="flag-topic" className={styles.topicBadge}>
                    {topic}
                  </span>
                ))}
              </div>
            )}
          </div>

          <Button
            size="sm"
            variant={flag.reviewed ? 'outline' : 'default'}
            disabled={flag.reviewed}
            onClick={(e: MouseEvent) => {
              e.preventDefault()
              e.stopPropagation()
              onMarkReviewed(flag.id)
            }}
            data-testid="mark-reviewed-button"
            aria-label={flag.reviewed ? 'Reviewed' : 'Mark as reviewed'}
          >
            {flag.reviewed ? '✓ Reviewed' : 'Mark as reviewed'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
