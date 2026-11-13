import { playerCircleFor } from '@hoe/accounts'

import { useFamilySession } from './FamilySessionContext.tsx'
import styles from './PlayerCircle.module.scss'

/**
 * Who is playing, as their initial in a circle that ends the top bar, linking
 * to hub to pick someone else. Outside the estate it only names the player;
 * signed out there is nothing.
 */
export function PlayerCircle() {
  const name = useFamilySession()?.name ?? null
  if (name === null) return null
  const { initial, label, href } = playerCircleFor(name, window.location.href)
  return href === null ? (
    <span
      className={styles.circle}
      role="img"
      aria-label={label}
      title={name}
      data-testid="player"
    >
      {initial}
    </span>
  ) : (
    <a
      className={styles.circle}
      href={href}
      aria-label={label}
      title={name}
      data-testid="player"
    >
      {initial}
    </a>
  )
}
