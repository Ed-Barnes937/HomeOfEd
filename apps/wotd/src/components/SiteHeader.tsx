import { hubUrlFor } from '@hoe/accounts'
import { Link } from '@tanstack/react-router'

import { PlayerCircle } from '../features/player/PlayerCircle.tsx'
import { formatShortDate } from '../formatDate.ts'
import { ArrowLeftIcon } from './icons.tsx'
import styles from './SiteHeader.module.scss'
import { ThemeToggle } from './ThemeToggle.tsx'

/**
 * The design's top bar, both sizes. Mobile: circular back-to-hub button,
 * centred wordmark label, theme toggle. Desktop: back-to-hub arrow + wordmark
 * on the left, date and toggle on the right. Both end with the player circle
 * when someone is signed in. The hub link swaps position per
 * breakpoint — one is always in the accessibility tree. (The design's "W"
 * mark was replaced: it read as a wotd home link, not a link to the hub.)
 */
export function SiteHeader() {
  const hub = hubUrlFor(window.location.href)
  return (
    <header className={styles.header}>
      <a className={styles.backMobile} href={hub} aria-label="Back to home of ed">
        <ArrowLeftIcon size={17} strokeWidth={2.4} />
      </a>
      <div className={styles.brand}>
        <a className={styles.mark} href={hub} aria-label="Back to home of ed">
          <ArrowLeftIcon size={17} strokeWidth={2.4} />
        </a>
        <Link to="/" className={styles.wordmark}>
          Word of the Day
        </Link>
      </div>
      <div className={styles.right}>
        <span className={styles.date}>{formatShortDate(new Date())}</span>
        <ThemeToggle />
        <PlayerCircle />
      </div>
    </header>
  )
}
