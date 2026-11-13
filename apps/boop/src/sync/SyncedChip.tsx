import { playerCircleFor } from '@hoe/accounts'

import styles from './SyncedChip.module.scss'

interface SyncedChipProps {
  /** The profile the boops are being kept for. */
  name: string
}

/**
 * The one piece of chrome the family account adds to boop (ADR 0080): who the
 * boops are being kept for, as their initial in a circle that ends the bar,
 * and a way to hub to switch player and come back here. Outside the estate
 * there is no hub to switch at, so it only names the player.
 */
export function SyncedChip({ name }: SyncedChipProps) {
  const { initial, label, href } = playerCircleFor(name, window.location.href)
  return href === null ? (
    <span
      className={styles.chip}
      role="img"
      aria-label={label}
      title={name}
      data-testid="synced-chip"
    >
      {initial}
    </span>
  ) : (
    <a
      className={styles.chip}
      href={href}
      aria-label={label}
      title={name}
      data-testid="synced-chip"
    >
      {initial}
    </a>
  )
}
