import { profileInitial, switchPlayerUrlFor } from '@hoe/accounts'

import { useFamilySession } from './FamilySessionContext.tsx'
import styles from './PlayerCircle.module.scss'

/**
 * Who is playing, as their initial in a circle in the top-right corner,
 * linking to hub to pick someone else. Outside the estate it only names the
 * player; signed out there is nothing.
 */
export function PlayerCircle() {
  const name = useFamilySession()?.name ?? null
  if (name === null) return null
  const href = switchPlayerUrlFor(window.location.href)
  const initial = profileInitial(name)
  return href === null ? (
    <span
      className={styles.circle}
      role="img"
      aria-label={`Playing as ${name}`}
      title={name}
      data-testid="player"
    >
      {initial}
    </span>
  ) : (
    <a
      className={styles.circle}
      href={href}
      aria-label={`Playing as ${name}. Switch player`}
      title={name}
      data-testid="player"
    >
      {initial}
    </a>
  )
}
