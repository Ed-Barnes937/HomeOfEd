import { hubUrlFor } from '@hoe/accounts'
import type { ReactNode } from 'react'

import { BOARD_NAME_MAX } from '../../server/boardSchema.ts'
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
  /** Who is playing (PlayerChip), when someone is. */
  playerSlot?: ReactNode
  /** A shared fridge: Keep (a full navigation, so it meets the gate) replaces Save and New. */
  keepHref?: string
  onKeep?: () => void
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
  playerSlot,
  keepHref,
  onKeep,
}: TopBarProps) {
  return (
    <div className={styles.bar} data-testid="top-bar">
      <div className={styles.left}>
        <a
          className={styles.back}
          href={hubUrlFor(window.location.href)}
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
        <span className={styles.wordmark} data-testid="wordmark">
          the fridge
        </span>
        <span className={styles.helper}>drag to bump · click to rotate · double-click to remove</span>
      </div>
      <div className={styles.right}>
        {playerSlot}
        <input
          className={styles.name}
          placeholder="name this fridge…"
          maxLength={BOARD_NAME_MAX}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
        {keepHref === undefined ? (
          <button type="button" className={styles.save} onClick={onSave} disabled={saveDisabled}>
            Save
          </button>
        ) : (
          <a className={`${styles.save} ${styles.keep}`} href={keepHref} onClick={onKeep}>
            Keep this fridge
          </a>
        )}
        {shareSlot}
        {keepHref === undefined && (
          <button type="button" className={styles.ghost} onClick={onNew}>
            New
          </button>
        )}
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
