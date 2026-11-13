import { profileInitial, switchPlayerUrlFor } from '@hoe/accounts'

import styles from './PlayerLink.module.scss'

/** Whose presets these are, as an avatar circle that goes to hub to switch player and come back (ADR 0094). */
export function PlayerLink({ name }: { name: string }) {
  const href = switchPlayerUrlFor(window.location.href)
  const initial = profileInitial(name)
  // Outside the estate there is no hub to switch at, so it only names the player.
  return href === null ? (
    <span
      className={styles.player}
      role="img"
      aria-label={`Playing as ${name}`}
      title={name}
      data-testid="player"
    >
      {initial}
    </span>
  ) : (
    <a
      className={styles.player}
      href={href}
      title={name}
      aria-label={`Playing as ${name}. Switch player`}
      data-testid="player"
    >
      {initial}
    </a>
  )
}
