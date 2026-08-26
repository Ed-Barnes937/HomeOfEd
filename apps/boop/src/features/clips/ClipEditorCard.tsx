import { useEffect, type ReactNode } from 'react'

import styles from './ClipEditorCard.module.scss'

interface ClipEditorCardProps {
  /** The clip on the grid — its name is the dialog's accessible name. */
  clipName: string
  onClose: () => void
  /** `ClipHeader` and the width's grid renderer. */
  children: ReactNode
}

/**
 * The clip editor card (screenspace ticket 03): the grid, opened from the song
 * bar. The paper-card dialog shell `BoopsPanel` and `NewClipPicker` use —
 * dimmed backdrop, a × in the corner — with two differences the grid forces.
 *
 * There is no card *title*: `ClipHeader` is the first thing inside and already
 * reads "You're changing ● <name>", so a title would state the clip twice. The
 * dialog's accessible name carries it instead.
 *
 * And the body is a bounded flex column, not a scroller. Both grid renderers
 * are already flex columns that scroll their rows in their own box with the
 * footer pinned under them (ADR 0030, as amended), so a scrolling body here
 * would be a second scroller over the top of one that works — and it would
 * scroll the clip play button away, which is the thing that box exists to
 * prevent.
 *
 * Dismiss follows the app's other dialogs: the × button, a tap on the dimmed
 * backdrop, and Escape — the hint sheet's key, on the app's one other
 * `aria-modal` dialog.
 *
 * Escape was held back at first on the grounds that the grid and the strips
 * own the keyboard in here. They do, but not this key: the grid claims the
 * arrows, Enter and Backspace, and both scrub strips claim Left, Right and
 * Home. Escape is free, so closing on it costs the grid nothing — and a
 * modal that traps a keyboard user with no key out is the worse trade.
 */
export function ClipEditorCard({ clipName, onClose, children }: ClipEditorCardProps) {
  // On `window`, like the hint sheet's: the grid's own cells stop keydown
  // bubbling for the keys they handle, and Escape has to reach us from
  // wherever focus happens to be inside the card.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className={styles.overlay} onClick={onClose} data-testid="clip-editor-overlay">
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label={`Editing ${clipName}`}
        onClick={(event) => event.stopPropagation()}
        data-testid="clip-editor-card"
      >
        <div className={styles.header}>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close the clip editor"
            data-testid="clip-editor-close-button"
          >
            ×
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  )
}
