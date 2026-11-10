import { switchPlayerUrlFor } from '@hoe/accounts'

import styles from './PlayerLink.module.scss'

function PlayerIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="6" r="3" />
      <path d="M3 15.5 c0.8 -3 3.2 -4.5 6 -4.5 s5.2 1.5 6 4.5" />
    </svg>
  )
}

/** Whose presets these are, and the way to hub to switch player and come back (ADR 0094). */
export function PlayerLink({ name }: { name: string }) {
  const href = switchPlayerUrlFor(window.location.href)
  const content = (
    <>
      <PlayerIcon />
      <span className={styles.name}>{name}</span>
    </>
  )
  // Outside the estate there is no hub to switch at, so it is the name alone.
  return href === null ? (
    <span className={styles.player} data-testid="player">
      {content}
    </span>
  ) : (
    <a
      className={styles.player}
      href={href}
      aria-label={`Playing as ${name}. Switch player`}
      data-testid="player"
    >
      {content}
    </a>
  )
}
