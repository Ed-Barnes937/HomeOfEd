import { playerCircleFor, switchPlayerUrlFor } from '@hoe/accounts'

import { useFamilySession } from './FamilySessionContext.tsx'
import styles from './SwitchPlayerLink.module.scss'

/**
 * Who is playing, as their initial in a circle that ends the header, linking
 * to hub to pick someone else (spec decision 10). Outside the estate it only
 * names the player; signed out in the estate it is an empty circle to choose one.
 */
export function SwitchPlayerLink() {
  const name = useFamilySession()?.name ?? null
  if (name === null) {
    const href = switchPlayerUrlFor(window.location.href)
    return href === null ? null : (
      <a
        className={styles.circle}
        href={href}
        aria-label="Choose who is playing"
        data-testid="switch-player"
      >
        <PersonGlyph />
      </a>
    )
  }
  const { initial, label, href } = playerCircleFor(name, window.location.href)
  return href === null ? (
    <span
      className={styles.circle}
      role="img"
      aria-label={label}
      title={name}
      data-testid="switch-player"
    >
      {initial}
    </span>
  ) : (
    <a className={styles.circle} href={href} aria-label={label} title={name} data-testid="switch-player">
      {initial}
    </a>
  )
}

function PersonGlyph() {
  return (
    <svg className={styles.glyph} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="5.5" r="3" />
      <path d="M2.5 15c0.6-3.4 2.8-5 5.5-5s4.9 1.6 5.5 5z" />
    </svg>
  )
}
