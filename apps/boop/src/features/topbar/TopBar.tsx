import { hubUrl } from '../../hubUrl.ts'
import { useShareGroove } from '../../share/useShareGroove.ts'
import styles from './TopBar.module.scss'

export interface TopBarProps {
  /**
   * The link for the groove as it is *right now* — called on tap, not on
   * render, so encoding the grid never rides along with playback repaints.
   */
  getShareUrl: () => string
  /** Opens the "My grooves" panel (ticket 20). */
  onOpenGrooves: () => void
  /** Opens the hint sheet (ticket 24). */
  onOpenHints: () => void
  /**
   * Renders the pattern to a WAV file and hands it to the share sheet
   * (mobile) or a download (desktop) — the demoted secondary under Share
   * (ticket 25, design handoff §5).
   */
  onExportWav: () => void
}

/**
 * The top bar: back-to-hub arrow, wordmark, and the chrome buttons from the
 * design handoff. "Share" is live (ticket 21) — the system share sheet on
 * mobile, clipboard plus a "Copied!" flip on desktop, no modal and no link
 * field. "My grooves" opens the grooves panel (ticket 20). "?" opens the
 * hint sheet (ticket 24).
 */
export function TopBar({ getShareUrl, onOpenGrooves, onOpenHints, onExportWav }: TopBarProps) {
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
      <button
        type="button"
        className={styles.ghost}
        onClick={onOpenGrooves}
        data-testid="grooves-button"
      >
        My grooves
      </button>
      <div className={styles.shareGroup}>
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
          className={styles.exportLink}
          data-testid="export-wav-button"
          onClick={onExportWav}
        >
          Save the sound as a file
        </button>
      </div>
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
