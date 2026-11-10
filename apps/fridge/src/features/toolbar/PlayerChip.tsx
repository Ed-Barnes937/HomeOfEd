import { switchPlayerUrlFor } from '@hoe/accounts'

import styles from './PlayerChip.module.scss'

interface PlayerChipProps {
  /** The profile the fridge is being kept for. */
  name: string
  /** The phone renders it as a menu entry; its 52px strip has no room for a chip. */
  className?: string
}

/** Who is playing, linking to hub to switch player (spec decision 10); words alone outside the estate. */
export function PlayerChip({ name, className }: PlayerChipProps) {
  const href = switchPlayerUrlFor(window.location.href)
  const label = `playing as ${name}`
  const content = (
    <>
      <svg
        className={styles.icon}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
      <span className={styles.label}>{label}</span>
    </>
  )
  const shared = {
    className: className ?? styles.chip,
    'data-testid': 'player-chip',
    'aria-label': label,
  }
  return href === null ? (
    <span {...shared} title={label}>
      {content}
    </span>
  ) : (
    <a {...shared} href={href} title={`${name} - switch player`}>
      {content}
    </a>
  )
}
