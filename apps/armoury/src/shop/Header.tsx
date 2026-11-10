import { hubUrlFor, switchPlayerUrlFor } from '@hoe/accounts'
import { Link } from '@tanstack/react-router'

import type { ShareState } from '../share/useShareWand.ts'
import styles from './Header.module.scss'

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

/** Who the wands are kept for, and the way to hub to switch player and come back (ADR 0094). */
function Player({ name }: { name: string }) {
  const href = switchPlayerUrlFor(window.location.href)
  const content = (
    <>
      <PlayerIcon />
      <span className={`${styles.label} ${styles.playerName}`}>{name}</span>
    </>
  )
  // Outside the estate there is no hub to switch at, so it is the name alone.
  return href === null ? (
    <span
      className={`${styles.button} ${styles.player} ${styles.static}`}
      role="img"
      aria-label={`Playing as ${name}`}
      data-testid="player"
    >
      {content}
    </span>
  ) : (
    <a
      className={`${styles.button} ${styles.player}`}
      href={href}
      aria-label={`Playing as ${name}. Switch player`}
      data-testid="player"
    >
      {content}
    </a>
  )
}

export function Header({
  shelfCount,
  player,
  shareState,
  onShare,
  pictureBusy,
  onPicture,
}: {
  /** `null` hides the shelf: the shared view keeps nothing. */
  shelfCount: number | null
  /** The player's name, or `null` for no chip (signed out, or the shared view). */
  player: string | null
  shareState: ShareState
  onShare: () => void
  pictureBusy: boolean
  onPicture: () => void
}) {
  return (
    <header className={player === null ? styles.header : `${styles.header} ${styles.withPlayer}`}>
      <div className={styles.brand}>
        <a
          className={styles.back}
          href={hubUrlFor(window.location.href)}
          aria-label="Back to home of ed"
        >
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
        </a>
        <span className={styles.name}>Armoury</span>
        <span className={styles.motto}>wands made to measure</span>
      </div>
      <nav className={styles.nav}>
        {player !== null && <Player name={player} />}
        {shelfCount !== null && (
          <Link
            to="/shelf"
            className={styles.button}
            aria-label={`Your shelf, ${shelfCount} wands`}
          >
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
          aria-label={shareState === 'copied' ? 'Link copied' : 'Share a link to this wand'}
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
          aria-label="Save a picture of this wand"
        >
          <PictureIcon />
          <span className={styles.label}>Picture</span>
        </button>
      </nav>
    </header>
  )
}
