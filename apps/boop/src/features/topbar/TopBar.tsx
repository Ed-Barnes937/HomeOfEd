import { useCallback, useEffect, useRef, useState } from 'react'

import { hubUrl } from '../../hubUrl.ts'
import { navigatorShareTarget, shareGrooveUrl } from '../../share/shareAction.ts'
import styles from './TopBar.module.scss'

/** "Copied!" holds this long, then the button goes back to resting (design §5). */
const COPIED_HOLD_MS = 1_600

type ShareState = 'idle' | 'pending' | 'copied'

export interface TopBarProps {
  /**
   * The link for the groove as it is *right now* — called on tap, not on
   * render, so encoding the grid never rides along with playback repaints.
   */
  getShareUrl: () => string
  /** Opens the "My grooves" panel (ticket 20). */
  onOpenGrooves: () => void
}

/**
 * The top bar: back-to-hub arrow, wordmark, and the chrome buttons from the
 * design handoff. "Share" is live (ticket 21) — the system share sheet on
 * mobile, clipboard plus a "Copied!" flip on desktop, no modal and no link
 * field. "My grooves" opens the grooves panel (ticket 20). "?" is still a
 * style-only placeholder.
 */
export function TopBar({ getShareUrl, onOpenGrooves }: TopBarProps) {
  const [shareState, setShareState] = useState<ShareState>('idle')
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (revertTimer.current !== null) clearTimeout(revertTimer.current)
    },
    [],
  )

  const share = useCallback(() => {
    if (shareState === 'pending') return
    setShareState('pending')
    void shareGrooveUrl(getShareUrl(), navigatorShareTarget(navigator)).then((outcome) => {
      if (outcome !== 'copied') {
        // Shared, dismissed or refused: the OS (or nothing) is the feedback.
        setShareState('idle')
        return
      }
      setShareState('copied')
      // Tapping again mid-hold restarts the 1.6s, rather than inheriting the
      // remainder of the previous one.
      if (revertTimer.current !== null) clearTimeout(revertTimer.current)
      revertTimer.current = setTimeout(() => setShareState('idle'), COPIED_HOLD_MS)
    })
  }, [getShareUrl, shareState])

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
