import { Link } from '@tanstack/react-router'

import { formatShortDate } from '../formatDate.ts'
import { hubUrl } from '../hubUrl.ts'
import { ArrowLeftIcon } from './icons.tsx'
import styles from './SiteHeader.module.scss'
import { ThemeToggle } from './ThemeToggle.tsx'

/**
 * The design's top bar, both sizes. Mobile: circular back-to-hub button,
 * centred wordmark label, theme toggle. Desktop: "W" mark + wordmark on the
 * left, date and toggle on the right. The hub link swaps form per breakpoint
 * (arrow button ↔ "W" mark) — one is always in the accessibility tree.
 */
export function SiteHeader() {
  const hub = hubUrl(window.location.hostname)
  return (
    <header className={styles.header}>
      <a className={styles.backMobile} href={hub} aria-label="Back to home of ed">
        <ArrowLeftIcon size={17} strokeWidth={2.4} />
      </a>
      <div className={styles.brand}>
        <a className={styles.mark} href={hub} aria-label="Back to home of ed">
          W
        </a>
        <Link to="/" className={styles.wordmark}>
          Word of the Day
        </Link>
      </div>
      <div className={styles.right}>
        <span className={styles.date}>{formatShortDate(new Date())}</span>
        <ThemeToggle />
      </div>
    </header>
  )
}
