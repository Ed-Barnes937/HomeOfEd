/**
 * Which of the two pills a card shows, if any. "New" wins while both windows
 * are open — an app's first deploy is also its latest one, so on launch day
 * every card would otherwise claim to be merely updated.
 */
import type { AppDates } from './appDates.ts'
import { isNew } from './isNew.ts'
import { isUpdated } from './isUpdated.ts'

export type Pill = 'new' | 'updated' | null

export function pillFor({ deployedAt, updatedAt }: AppDates, now: Date): Pill {
  if (isNew(deployedAt, now)) return 'new'
  if (isUpdated(updatedAt, now)) return 'updated'
  return null
}
