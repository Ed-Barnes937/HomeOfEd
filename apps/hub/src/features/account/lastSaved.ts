import type { SaveSummaryOutput } from '@hoe/accounts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function ago(count: number, unit: string): string {
  return `saved ${count} ${unit}${count === 1 ? '' : 's'} ago`
}

/** How long ago, in the coarsest unit that still reads naturally. */
export function savedAgo(updatedAt: number, now: number): string {
  const elapsed = now - updatedAt
  if (elapsed < MINUTE) return 'saved just now'
  if (elapsed < HOUR) return ago(Math.floor(elapsed / MINUTE), 'minute')
  if (elapsed < DAY) return ago(Math.floor(elapsed / HOUR), 'hour')
  if (elapsed < 60 * DAY) return ago(Math.floor(elapsed / DAY), 'day')
  if (elapsed < 365 * DAY) return ago(Math.floor(elapsed / (30 * DAY)), 'month')
  return ago(Math.floor(elapsed / (365 * DAY)), 'year')
}

/** One line per app this account has saved in, such as "boop: saved 2 days ago". */
export function lastSavedLines(
  summary: SaveSummaryOutput,
  accountId: string,
  now: number,
): string[] {
  return summary
    .filter((entry) => entry.accountId === accountId)
    .map((entry) => `${entry.appId}: ${savedAgo(entry.updatedAt, now)}`)
}
