import { useState } from 'react'

import { hubUrl } from '../../hubUrl.ts'
import { useShareGroove } from '../../share/useShareGroove.ts'
import { CLEAR_GRID_CONFIRM } from '../confirm/clearGridConfirm.ts'
import { ConfirmCard } from '../confirm/ConfirmCard.tsx'
import styles from './PhoneBar.module.scss'

export interface PhoneBarProps {
  /** The link for the groove as it is *right now* — called on tap, not on render. */
  getShareUrl: () => string
  onClearGrid: () => void
  /**
   * Save the working grid into "My grooves" (ticket 20). The chrome strip has
   * no room for the "Saved it" moment, so this opens the grooves panel already
   * saved — same path as its own Save button.
   */
  onSave: () => void
  /** Open the "My grooves" panel (ticket 20). */
  onOpenMyGrooves: () => void
  /** Open the "How boop works" hint sheet (ticket 24). */
  onOpenHints: () => void
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
 * menu holding My grooves, Share, How boop works and Clear grid. The idiom and
 * the back / save / overflow glyphs are the fridge's `MobileBar` verbatim —
 * copied, never imported, since apps are leaf nodes — so boop's chrome matches
 * the rest of homeofed. Every tap target clears 44px.
 */
export function PhoneBar({
  getShareUrl,
  onClearGrid,
  onSave,
  onOpenMyGrooves,
  onOpenHints,
}: PhoneBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const { shareState, share } = useShareGroove(getShareUrl)
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
        aria-label="Save this groove"
        data-testid="phone-save-button"
        onClick={onSave}
      >
        <SaveIcon />
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
            data-testid="phone-menu-my-grooves"
            onClick={withClose(onOpenMyGrooves)}
          >
            My grooves
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
