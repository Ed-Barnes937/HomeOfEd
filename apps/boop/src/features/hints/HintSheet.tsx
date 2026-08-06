import { useEffect, type ReactNode } from 'react'

import styles from './HintSheet.module.scss'

export interface HintSheetProps {
  open: boolean
  onClose: () => void
}

interface Hint {
  label: string
  picture: ReactNode
}

// Content placeholders: covers exactly the four things the spec calls out
// ("Onboarding & light education" — paint the grid, press play, tempo,
// share). Pictures are simple inline SVGs standing in for real
// illustrations — flagged for design follow-up, since the handoff
// (docs/reference/boop-design/README.md) explicitly does not cover hint-sheet
// content.
const HINTS: Hint[] = [
  {
    label: 'Tap the grid to paint sounds',
    picture: (
      <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
        <rect x="2" y="2" width="12" height="12" rx="3" fill="currentColor" />
        <rect x="18" y="2" width="12" height="12" rx="3" fill="currentColor" opacity="0.3" />
        <rect x="2" y="18" width="12" height="12" rx="3" fill="currentColor" opacity="0.3" />
        <rect x="18" y="18" width="12" height="12" rx="3" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: 'Press play to hear your loop',
    picture: (
      <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
        <circle cx="16" cy="16" r="14" fill="currentColor" opacity="0.15" />
        <path d="M12 9l12 7-12 7V9z" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: 'Tempo makes it faster or slower',
    picture: (
      <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
        <path d="M4 24h24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="12" cy="24" r="3" fill="currentColor" />
        <path d="M12 24l10-16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Share sends your loop to a friend',
    picture: (
      <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
        <circle cx="7" cy="16" r="4" fill="currentColor" />
        <circle cx="24" cy="7" r="4" fill="currentColor" opacity="0.5" />
        <circle cx="24" cy="25" r="4" fill="currentColor" opacity="0.5" />
        <path d="M10.5 14l10-5.5M10.5 18l10 5.5" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
]

/**
 * The single static hint sheet from the spec ("Onboarding & light
 * education"): no tooltips machinery, no forced steps, one screen a child
 * can open from the "?" in the top bar and dismiss by touch. Content here is
 * first-pass placeholder copy/pictures styled on the paper tokens — the
 * design handoff does not cover hint-sheet content, so it's flagged for a
 * follow-up pass. Exported so ticket 27 can open the same sheet from the
 * phone "⋯" menu.
 */
export function HintSheet({ open, onClose }: HintSheetProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.overlay} data-testid="hint-sheet-overlay" onClick={onClose}>
      <div
        className={styles.card}
        data-testid="hint-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hint-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <p id="hint-sheet-title" className={styles.title}>
            How boop works
          </p>
          <button
            type="button"
            className={styles.close}
            aria-label="Close"
            data-testid="hint-sheet-close"
            onClick={onClose}
          >
            &times;
          </button>
        </div>
        <ul className={styles.hints}>
          {HINTS.map((hint) => (
            <li key={hint.label} className={styles.hint}>
              <span className={styles.picture}>{hint.picture}</span>
              <span className={styles.label}>{hint.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
