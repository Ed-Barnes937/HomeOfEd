// Ported from the source (behaviour/markup). Tailwind classes retained; SCSS is P7.
import type { MouseEvent } from 'react'

import type { FlagSummary } from '../../features/flags/flagsQueries.ts'
import { Button } from '../ui/button.tsx'
import { Card, CardContent } from '../ui/card.tsx'

const FLAG_TYPE_STYLES: Record<FlagSummary['type'], { label: string; className: string }> = {
  sensitive: { label: 'Sensitive', className: 'bg-yellow-100 text-yellow-800' },
  blocked: { label: 'Blocked', className: 'bg-red-100 text-red-800' },
  'validation-failed': { label: 'Validation Failed', className: 'bg-orange-100 text-orange-800' },
  reported: { label: 'Reported', className: 'bg-blue-100 text-blue-800' },
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
    className: 'bg-gray-100 text-gray-800',
  }
  const outcome = FLAG_OUTCOMES[flag.type]
  const parsedTopics = parseTopics(flag.topics)

  return (
    <Card data-testid="flag-item">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{flag.childDisplayName}</span>
              <span
                data-testid="flag-type-badge"
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeStyle.className}`}
              >
                {typeStyle.label}
              </span>
              <span className="text-muted-foreground text-xs">
                {new Date(flag.createdAt).toLocaleString()}
              </span>
            </div>

            <p className="mt-1 text-sm">{flag.reason}</p>

            {outcome && (
              <p
                data-testid="flag-outcome"
                className={`mt-1 text-xs font-medium ${
                  outcome.reachedChild ? 'text-amber-700' : 'text-green-700'
                }`}
              >
                {outcome.reachedChild ? '⚠ ' : '✓ '}
                {outcome.label}
              </p>
            )}

            {parsedTopics.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {parsedTopics.map((topic) => (
                  <span
                    key={topic}
                    data-testid="flag-topic"
                    className="bg-muted inline-flex items-center rounded px-1.5 py-0.5 text-xs"
                  >
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
