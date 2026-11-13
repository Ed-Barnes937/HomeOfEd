import { playerCircleFor } from '@hoe/accounts'

import styles from './PlayerChip.module.scss'

interface PlayerChipProps {
  /** The profile the fridge is being kept for. */
  name: string
}

/** Who is playing, as an avatar circle linking to hub to switch player (spec decision 10); a plain circle outside the estate. */
export function PlayerChip({ name }: PlayerChipProps) {
  const { initial, label, href } = playerCircleFor(name, window.location.href)
  const shared = { className: styles.chip, 'data-testid': 'player-chip', title: name, 'aria-label': label }
  return href === null ? (
    <span {...shared} role="img">
      {initial}
    </span>
  ) : (
    <a {...shared} href={href}>
      {initial}
    </a>
  )
}
