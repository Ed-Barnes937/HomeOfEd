import { type ReactNode, useState } from 'react'

import type { StoredBoard } from '../board/serialize.ts'
import { hubUrl } from '../../hubUrl.ts'
import { SavedChips } from './SavedChips.tsx'
import styles from './MobileBar.module.scss'

interface MobileBarProps {
  name: string
  onNameChange: (name: string) => void
  onSave: () => void
  onNew: () => void
  onClear: () => void
  clearDisabled?: boolean
  saveDisabled?: boolean
  /** The share affordance (features/share) — a slot, as on the desktop TopBar. */
  shareSlot?: ReactNode
  /** Saved boards live in the overflow menu on mobile (reuses SavedChips). */
  saved: StoredBoard[]
  onLoad: (name: string) => void
  onDelete: (name: string) => void
}

/**
 * Mobile chrome (ADR 0023): a slim icon strip replacing the desktop TopBar +
 * SavedChips. Back, a compact wordmark, a Save icon, and an overflow "⋯" menu
 * holding name editing, New, Empty the fridge, Share, and the saved boards —
 * every desktop action stays reachable. Rendered only below the breakpoint, so
 * desktop is untouched. Tap targets are ≥44px.
 */
export function MobileBar({
  name,
  onNameChange,
  onSave,
  onNew,
  onClear,
  clearDisabled = false,
  saveDisabled = false,
  shareSlot,
  saved,
  onLoad,
  onDelete,
}: MobileBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const withClose = (fn: () => void) => () => {
    fn()
    setMenuOpen(false)
  }

  return (
    <div className={styles.bar} data-testid="mobile-bar">
      <a className={styles.icon} href={hubUrl(window.location.hostname)} aria-label="Back to home of ed">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        </svg>
      </a>

      <span className={styles.wordmark}>the fridge</span>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.icon}
          aria-label="Save"
          onClick={onSave}
          disabled={saveDisabled}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <path d="M17 21v-8H7v8M7 3v5h8" />
          </svg>
        </button>
        <button
          type="button"
          className={styles.icon}
          aria-label="More actions"
          aria-expanded={menuOpen}
          data-testid="mobile-menu-button"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className={styles.menu} data-testid="mobile-menu">
          <input
            className={styles.name}
            placeholder="name this fridge…"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
          <div className={styles.shareRow}>{shareSlot}</div>
          <button type="button" className={styles.item} onClick={withClose(onNew)}>
            New
          </button>
          <button
            type="button"
            className={`${styles.item} ${styles.danger}`}
            onClick={withClose(onClear)}
            disabled={clearDisabled}
          >
            Empty the fridge
          </button>
          <div className={styles.savedCap}>Saved fridges</div>
          <SavedChips saved={saved} activeName={name} onLoad={onLoad} onDelete={onDelete} />
        </div>
      )}
    </div>
  )
}
