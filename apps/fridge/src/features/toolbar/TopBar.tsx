import type { ReactNode } from 'react'

import { hubUrl } from '../../hubUrl.ts'
import styles from './TopBar.module.scss'

interface TopBarProps {
  name: string
  onNameChange: (name: string) => void
  onSave: () => void
  onNew: () => void
  onClear: () => void
  /** Disable "Empty the fridge" when the board is empty (a no-op sweep looks broken). */
  clearDisabled?: boolean
  /** Disable Save while the board sweeps out — it would snapshot magnets about to clear. */
  saveDisabled?: boolean
  /** The share affordance (features/share) — a slot so the toolbar stays presentational. */
  shareSlot?: ReactNode
}

/**
 * Top toolbar (region A): brand wordmark + helper text on the left, the
 * name input and Save/New/Empty buttons on the right. The name input is
 * controlled by the active board's name; Save upserts it into the saved
 * chips (falling back to "Fridge N" when empty — see useFridgeBoard.save).
 */
export function TopBar({
  name,
  onNameChange,
  onSave,
  onNew,
  onClear,
  clearDisabled = false,
  saveDisabled = false,
  shareSlot,
}: TopBarProps) {
  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <a
          className={styles.back}
          href={hubUrl(window.location.hostname)}
          aria-label="Back to home of ed"
        >
          <svg
            width="20"
            height="20"
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
        <span className={styles.wordmark}>the fridge</span>
        <span className={styles.helper}>drag to bump · click to rotate · double-click to remove</span>
      </div>
      <div className={styles.right}>
        <input
          className={styles.name}
          placeholder="name this fridge…"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
        <button type="button" className={styles.save} onClick={onSave} disabled={saveDisabled}>
          Save
        </button>
        {shareSlot}
        <button type="button" className={styles.ghost} onClick={onNew}>
          New
        </button>
        <button
          type="button"
          className={`${styles.ghost} ${styles.clear}`}
          onClick={onClear}
          disabled={clearDisabled}
        >
          Empty the fridge
        </button>
      </div>
    </div>
  )
}
