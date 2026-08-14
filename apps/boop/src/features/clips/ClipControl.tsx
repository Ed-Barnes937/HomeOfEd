import { useState } from 'react'

import { CLEAR_GRID_CONFIRM } from '../confirm/clearGridConfirm.ts'
import { ConfirmCard } from '../confirm/ConfirmCard.tsx'
import styles from './ClipControl.module.scss'

interface ClipControlProps {
  isPlaying: boolean
  /** Play/stop looping the clip on the grid — the old transport's play button. */
  onToggle: () => void
  /** Clears the clip on the grid only — an *edit*, not a reset (spec §7). */
  onClearGrid: () => void
}

/**
 * The clip control (design handoff §4): lives inside the grid well, below the
 * rows. The yellow play loops just the grid clip's 4 bars; Clear grid moved
 * here from the old transport bar and is now clip-scoped. It keeps its
 * confirm — same copy, both homes (`clearGridConfirm.ts`).
 */
export function ClipControl({ isPlaying, onToggle, onClearGrid }: ClipControlProps) {
  const [confirmingClear, setConfirmingClear] = useState(false)

  return (
    <div className={styles.control} data-testid="clip-control">
      <button
        type="button"
        className={styles.play}
        onClick={onToggle}
        aria-pressed={isPlaying}
        aria-label={isPlaying ? 'Stop this clip' : 'Play this clip'}
        data-testid="play-button"
      >
        {isPlaying ? (
          <span className={styles.pause} aria-hidden="true">
            <span className={styles.pauseBar} />
            <span className={styles.pauseBar} />
          </span>
        ) : (
          <span className={styles.triangle} aria-hidden="true" />
        )}
      </button>
      <div className={styles.labels}>
        <span className={styles.title}>{isPlaying ? 'Stop' : 'Play this clip'}</span>
        <span className={styles.sub}>Just these 4 bars, round and round</span>
      </div>
      <div className={styles.spacer} />
      <button
        type="button"
        className={styles.clear}
        onClick={() => setConfirmingClear(true)}
        data-testid="clear-grid-button"
      >
        Clear grid
      </button>
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
