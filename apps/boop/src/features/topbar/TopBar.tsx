import { hubUrl } from '../../hubUrl.ts'
import { useShareGroove } from '../../share/useShareGroove.ts'
import styles from './TopBar.module.scss'

export interface TopBarProps {
  /**
   * The link for the groove as it is *right now* — called on tap, not on
   * render, so encoding the grid never rides along with playback repaints.
   */
  getShareUrl: () => string
}

/**
 * The top bar: back-to-hub arrow, wordmark, and the chrome buttons from the
 * design handoff. "Share" is live (ticket 21) — the system share sheet on
 * mobile, clipboard plus a "Copied!" flip on desktop, no modal and no link
 * field. "My grooves" and "?" are still style-only placeholders.
 */
export function TopBar({ getShareUrl }: TopBarProps) {
  const { shareState, share } = useShareGroove(getShareUrl)
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
      <div className={styles.spacer} />
      <button type="button" className={styles.ghost} aria-disabled="true">
        My grooves
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
      <button type="button" className={styles.help} aria-label="How boop works" aria-disabled="true">
        ?
      </button>
    </header>
  )
}
