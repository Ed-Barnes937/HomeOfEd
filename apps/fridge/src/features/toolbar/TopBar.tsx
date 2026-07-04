import type { ReactNode } from 'react'

import styles from './TopBar.module.scss'

interface TopBarProps {
  name: string
  onNameChange: (name: string) => void
  onSave: () => void
  onNew: () => void
  onClear: () => void
  /** The share affordance (features/share) — a slot so the toolbar stays presentational. */
  shareSlot?: ReactNode
}

/**
 * Top toolbar (region A): brand wordmark + helper text on the left, the
 * name input and Save/New/Clear buttons on the right. The name input is
 * controlled by the active board's name; Save upserts it into the saved
 * chips (falling back to "Fridge N" when empty — see useFridgeBoard.save).
 */
export function TopBar({ name, onNameChange, onSave, onNew, onClear, shareSlot }: TopBarProps) {
  return (
    <div className={styles.bar}>
      <div className={styles.left}>
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
        <button type="button" className={styles.save} onClick={onSave}>
          Save
        </button>
        {shareSlot}
        <button type="button" className={styles.ghost} onClick={onNew}>
          New
        </button>
        <button type="button" className={`${styles.ghost} ${styles.clear}`} onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  )
}
