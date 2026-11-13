import { profileInitial, switchPlayerUrlFor } from '@hoe/accounts'

import { useFamilySession } from './FamilySessionContext.tsx'
import styles from './SwitchPlayerLink.module.scss'

/**
 * Who is playing, as their initial in a circle that ends the header, linking
 * to hub to pick someone else (spec decision 10). Outside the estate it only
 * names the player; signed out in the estate it is the bare words.
 */
export function SwitchPlayerLink() {
  const name = useFamilySession()?.name ?? null
  const href = switchPlayerUrlFor(window.location.href)
  if (name === null) {
    return href === null ? null : (
      <a className={styles.words} href={href} data-testid="switch-player">
        switch player
      </a>
    )
  }
  const initial = profileInitial(name)
  return href === null ? (
    <span
      className={styles.circle}
      role="img"
      aria-label={`Playing as ${name}`}
      title={name}
      data-testid="switch-player"
    >
      {initial}
    </span>
  ) : (
    <a
      className={styles.circle}
      href={href}
      aria-label={`Playing as ${name}. Switch player`}
      title={name}
      data-testid="switch-player"
    >
      {initial}
    </a>
  )
}
