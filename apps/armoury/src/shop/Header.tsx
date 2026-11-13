import { profileInitial, switchPlayerUrlFor } from '@hoe/accounts'
import { Link } from '@tanstack/react-router'

import type { ShareState } from '../share/useShareWand.ts'
import styles from './Header.module.scss'
import type { ShopCopy } from './shopView.ts'

export function ShelfIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="14" height="3.5" rx="0.6" />
      <rect x="2" y="7.5" width="14" height="3.5" rx="0.6" />
      <rect x="2" y="12" width="14" height="3.5" rx="0.6" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 11.5 V2.5 M5.5 6 L9 2.5 L12.5 6" />
      <path d="M3.5 9.5 v5 a1 1 0 0 0 1 1 h9 a1 1 0 0 0 1 -1 v-5" />
    </svg>
  )
}

function PictureIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="14" height="12" rx="1.5" />
      <path d="M2.5 13 L7 8.5 L10 11.5 L12 9.5 L15.5 13" />
      <circle cx="12" cy="6.5" r="1.2" />
    </svg>
  )
}

/** Who the shelf belongs to, and the way to hub to switch player and come back (ADR 0094). */
export function Player({ name, className }: { name: string; className?: string }) {
  const classes = [styles.player, className].filter(Boolean).join(' ')
  const href = switchPlayerUrlFor(window.location.href)
  // Outside the estate there is no hub to switch at, so it is the circle alone.
  return href === null ? (
    <span
      className={`${classes} ${styles.static}`}
      role="img"
      aria-label={`Playing as ${name}`}
      title={name}
      data-testid="player"
    >
      {profileInitial(name)}
    </span>
  ) : (
    <a
      className={classes}
      href={href}
      aria-label={`Playing as ${name}. Switch player`}
      title={name}
      data-testid="player"
    >
      {profileInitial(name)}
    </a>
  )
}

export function Header({
  copy,
  shelfCount,
  player,
  shareState,
  onShare,
  pictureBusy,
  onPicture,
}: {
  copy: ShopCopy
  /** `null` is the shared view: it keeps nothing, so no shelf, and the street is a page load the gate sees. */
  shelfCount: number | null
  /** The player's name, or `null` for no chip (signed out, or the shared view). */
  player: string | null
  shareState: ShareState
  onShare: () => void
  pictureBusy: boolean
  onPicture: () => void
}) {
  const back = (
    <>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 3 L5 8 L10 13" />
      </svg>
      <span className={styles.label}>Street</span>
    </>
  )
  return (
    <header className={player === null ? styles.header : `${styles.header} ${styles.withPlayer}`}>
      <div className={styles.brand}>
        {shelfCount === null ? (
          <a
            href="/street"
            className={`${styles.button} ${styles.back}`}
            aria-label="Back to the street"
          >
            {back}
          </a>
        ) : (
          <Link
            to="/street"
            className={`${styles.button} ${styles.back}`}
            aria-label="Back to the street"
          >
            {back}
          </Link>
        )}
        <span className={styles.name}>Armoury</span>
        <span className={styles.motto}>{copy.motto}</span>
      </div>
      <nav className={styles.nav}>
        {shelfCount !== null && (
          <Link to="/shelf" className={styles.button} aria-label={copy.shelfLink(shelfCount)}>
            <ShelfIcon />
            <span className={styles.label}>Your shelf</span>
            <span className={styles.count} aria-hidden="true">
              {shelfCount}
            </span>
          </Link>
        )}
        <button
          type="button"
          className={styles.button}
          onClick={onShare}
          aria-label={shareState === 'copied' ? 'Link copied' : copy.share}
        >
          <ShareIcon />
          <span className={styles.label} aria-live="polite">
            {shareState === 'copied' ? 'Copied!' : 'Share'}
          </span>
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={onPicture}
          disabled={pictureBusy}
          aria-label={copy.picture}
        >
          <PictureIcon />
          <span className={styles.label}>Picture</span>
        </button>
        {player !== null && <Player name={player} />}
      </nav>
    </header>
  )
}
