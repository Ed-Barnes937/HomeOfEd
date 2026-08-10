import { hubUrl } from '../../hubUrl.ts'
import { savedStateLabel, type LoadedBoop } from '../../savedState.ts'
import { useShareBoop } from '../../share/useShareBoop.ts'
import styles from './TopBar.module.scss'

export interface TopBarProps {
  /**
   * The link for the boop as it is *right now* — called on tap, not on
   * render, so encoding the grid never rides along with playback repaints.
   */
  getShareUrl: () => string
  /** Opens the "My boops" panel (ticket 20). */
  onOpenBoops: () => void
  /** Opens the hint sheet (ticket 24). */
  onOpenHints: () => void
  /** The saved boop this grid came from, or `null` (ticket 31) — drives the indicator. */
  loaded: LoadedBoop | null
}

/**
 * The top bar: back-to-hub arrow, wordmark, and the chrome buttons from the
 * design handoff. "Share" is live (ticket 21) — the system share sheet on
 * mobile, clipboard plus a "Copied!" flip on desktop, no modal and no link
 * field. "My boops" opens the boops panel (ticket 20), which is also where WAV
 * export now lives — per saved boop, not as a link under Share (ticket 34).
 * "?" opens the hint sheet (ticket 24).
 *
 * The saved/edited indicator (ticket 31) sits after the wordmark, before the
 * spacer — quiet chrome at half ink, never a status bar.
 */
export function TopBar({ getShareUrl, onOpenBoops, onOpenHints, loaded }: TopBarProps) {
  const { shareState, share } = useShareBoop(getShareUrl)
  const copied = shareState === 'copied'

  return (
    <header className={styles.bar}>
      <a className={styles.back} href={hubUrl(window.location.hostname)} aria-label="Back to home of ed">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        </svg>
      </a>
      <span className={styles.wordmark}>boop</span>
      <span className={styles.savedState} data-testid="saved-state">
        {savedStateLabel(loaded)}
      </span>
      <div className={styles.spacer} />
      <button
        type="button"
        className={styles.ghost}
        onClick={onOpenBoops}
        data-testid="boops-button"
      >
        My boops
      </button>
      <button
        type="button"
        className={`${styles.primary}${copied ? ` ${styles.copied}` : ''}`}
        data-testid="share-button"
        data-share-state={shareState}
        onClick={share}
      >
        {copied ? (
          <>
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m5 13 4 4L19 7" />
            </svg>
            Copied!
          </>
        ) : (
          'Share'
        )}
      </button>
      <button
        type="button"
        className={styles.help}
        aria-label="How boop works"
        data-testid="help-button"
        onClick={onOpenHints}
      >
        ?
      </button>
    </header>
  )
}
