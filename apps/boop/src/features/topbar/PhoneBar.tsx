import { useState } from 'react'

import { hubUrl } from '../../hubUrl.ts'
import { isUnsaved, type LoadedBoop } from '../../savedState.ts'
import { useShareBoop } from '../../share/useShareBoop.ts'
import { CLEAR_GRID_CONFIRM } from '../confirm/clearGridConfirm.ts'
import { ConfirmCard } from '../confirm/ConfirmCard.tsx'
import styles from './PhoneBar.module.scss'

export interface PhoneBarProps {
  /** The link for the boop as it is *right now* — called on tap, not on render. */
  getShareUrl: () => string
  onClearGrid: () => void
  /**
   * Go and save the working grid (ticket 20): opens "My boops", whose save
   * form is always on and already prefilled (ticket 32). The strip has no room
   * to confirm a save of its own, and since the form is the confirmation, the
   * icon does not save anything by itself.
   */
  onSave: () => void
  /** Open the "My boops" panel (ticket 20). */
  onOpenMyBoops: () => void
  /** Open the "How boop works" hint sheet (ticket 24). */
  onOpenHints: () => void
  /** The saved boop this grid came from, or `null` (ticket 31) — drives the save icon's dot. */
  loaded: LoadedBoop | null
}

const BackArrowIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </svg>
)

const SaveIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <path d="M17 21v-8H7v8M7 3v5h8" />
  </svg>
)

const OverflowIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </svg>
)

const CheckIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 13 4 4L19 7" />
  </svg>
)

/**
 * Phone chrome (ticket 27; design handoff, "Main screen — small phone" →
 * "Chrome — the 52px strip"): back, the compact wordmark, save, and a "⋯"
 * menu holding My boops, Share, How boop works and Clear grid. The idiom and
 * the back / save / overflow glyphs are the fridge's `MobileBar` verbatim —
 * copied, never imported, since apps are leaf nodes — so boop's chrome matches
 * the rest of homeofed. Every tap target clears 44px.
 *
 * The saved/edited state (ticket 31) rides on the save icon as a dot rather
 * than as words: the strip is full — back, wordmark, save, "⋯" — and the save
 * icon is the one spot in the phone chrome that already means "saving".
 */
export function PhoneBar({
  getShareUrl,
  onClearGrid,
  onSave,
  onOpenMyBoops,
  onOpenHints,
  loaded,
}: PhoneBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const { shareState, share } = useShareBoop(getShareUrl)
  const copied = shareState === 'copied'

  const withClose = (fn: () => void) => () => {
    fn()
    setMenuOpen(false)
  }

  return (
    <div className={styles.bar} data-testid="phone-bar">
      <a className={styles.icon} href={hubUrl(window.location.hostname)} aria-label="Back to home of ed">
        <BackArrowIcon />
      </a>

      <span className={styles.wordmark}>boop</span>

      <button
        type="button"
        className={styles.icon}
        // The dot is the sighted half of this; the label carries the same
        // state for anyone who cannot see it, since the phone has no room for
        // the desktop bar's words.
        aria-label={isUnsaved(loaded) ? 'Save this boop' : 'Save this boop (saved)'}
        data-testid="phone-save-button"
        onClick={onSave}
      >
        <SaveIcon />
        <span
          className={styles.savedDot}
          data-unsaved={isUnsaved(loaded)}
          data-testid="phone-saved-dot"
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        className={styles.icon}
        aria-label="More"
        aria-expanded={menuOpen}
        data-testid="phone-menu-button"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <OverflowIcon />
      </button>

      {menuOpen && (
        <div className={styles.menu} data-testid="phone-menu">
          <button
            type="button"
            className={styles.item}
            data-testid="phone-menu-my-boops"
            onClick={withClose(onOpenMyBoops)}
          >
            My boops
          </button>
          {/* Share keeps the menu open so the "Copied!" flip is seen — the
              clipboard path has no other feedback, and the design forbids a
              toast or a link field. */}
          <button
            type="button"
            className={styles.item}
            data-testid="share-button"
            data-share-state={shareState}
            onClick={share}
          >
            {copied ? (
              <>
                <CheckIcon />
                Copied!
              </>
            ) : (
              'Share'
            )}
          </button>
          <button
            type="button"
            className={styles.item}
            data-testid="phone-menu-hints"
            onClick={withClose(onOpenHints)}
          >
            How boop works
          </button>
          <button
            type="button"
            className={`${styles.item} ${styles.danger}`}
            data-testid="clear-grid-button"
            onClick={withClose(() => setConfirmingClear(true))}
          >
            Clear grid
          </button>
        </div>
      )}

      {confirmingClear && (
        <ConfirmCard
          {...CLEAR_GRID_CONFIRM}
          onSafe={() => setConfirmingClear(false)}
          onDestructive={() => {
            onClearGrid()
            setConfirmingClear(false)
          }}
        />
      )}
    </div>
  )
}
