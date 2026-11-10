import { switchPlayerUrlFor } from '@hoe/accounts'

import styles from './PlayerChip.module.scss'

interface PlayerChipProps {
  /** The profile the fridge is being kept for. */
  name: string
  /** The phone renders it as a menu entry; its 52px strip has no room for a chip. */
  className?: string
}

/**
 * Who the fridge is being kept for, and the way to hub to switch player and
 * come back here (spec decision 10). Outside the estate there is no hub to
 * switch at, so it is words alone.
 */
export function PlayerChip({ name, className }: PlayerChipProps) {
  const href = switchPlayerUrlFor(window.location.href)
  const label = `playing as ${name}`
  return href === null ? (
    <span className={className ?? styles.chip} data-testid="player-chip">
      {label}
    </span>
  ) : (
    <a
      className={className ?? styles.chip}
      href={href}
      data-testid="player-chip"
      title="Switch player"
    >
      {label}
    </a>
  )
}
