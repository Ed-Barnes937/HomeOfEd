import { playerCircleFor } from '@hoe/accounts'

import styles from './PlayerLink.module.scss'

/** Whose presets these are, as an avatar circle that goes to hub to switch player (ADR 0094). */
export function PlayerLink({ name }: { name: string }) {
  const { initial, label, href } = playerCircleFor(name, window.location.href)
  // Outside the estate there is no hub to switch at, so it only names the player.
  return href === null ? (
    <span className={styles.player} role="img" aria-label={label} title={name} data-testid="player">
      {initial}
    </span>
  ) : (
    <a className={styles.player} href={href} title={name} aria-label={label} data-testid="player">
      {initial}
    </a>
  )
}
