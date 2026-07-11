import type { StoredBoard } from '../board/serialize.ts'
import styles from './SavedChips.module.scss'

interface SavedChipsProps {
  saved: StoredBoard[]
  activeName: string
  onLoad: (name: string) => void
  onDelete: (name: string) => void
  /** Locks chip load/delete while the board sweeps out. */
  disabled?: boolean
  /**
   * Lay the row out in normal flow instead of floating it below the desktop
   * TopBar (region B). Set by the mobile overflow menu, which hosts this row
   * as an ordinary flex child — see MobileBar (ADR 0023).
   */
  inline?: boolean
}

/**
 * Saved-fridge chips row (region B). Empty state is the muted caption; each
 * chip loads its board on click, and its trailing × deletes it
 * (stopPropagation so it doesn't also load). The active chip — the one
 * matching the current board's name — renders filled (handoff's recipe).
 */
export function SavedChips({
  saved,
  activeName,
  onLoad,
  onDelete,
  disabled = false,
  inline = false,
}: SavedChipsProps) {
  const rowClass = `${styles.row} ${inline ? styles.inline : ''}`

  if (saved.length === 0) {
    return (
      <div className={rowClass}>
        <span className={styles.empty}>
          No saved fridges yet — arrange some magnets and hit Save.
        </span>
      </div>
    )
  }

  return (
    <div className={rowClass}>
      {saved.map((board) => (
        <button
          key={board.name}
          type="button"
          data-testid="saved-chip"
          data-active={board.name === activeName}
          className={`${styles.chip} ${board.name === activeName ? styles.active : ''}`}
          disabled={disabled}
          onClick={() => onLoad(board.name)}
        >
          {board.name}
          <span
            role="button"
            aria-label={`delete ${board.name}`}
            className={styles.remove}
            onClick={(e) => {
              e.stopPropagation()
              onDelete(board.name)
            }}
          >
            ×
          </span>
        </button>
      ))}
    </div>
  )
}
