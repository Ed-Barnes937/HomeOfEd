import { useState } from 'react'

import { CLEAR_GRID_CONFIRM } from '../confirm/clearGridConfirm.ts'
import { ConfirmCard } from '../confirm/ConfirmCard.tsx'
import styles from './Transport.module.scss'

interface TransportProps {
  isPlaying: boolean
  onToggle: () => void
  onClearAll: () => void
  /** The plain New boop reset (spec §7): one blank clip, no dialog, no confirm. */
  onNewBoop: () => void
  /**
   * Whether Clear grid (and its divider) belong to this bar. False on the
   * phone, where the action lives in the "⋯" menu instead — design handoff:
   * "Everything else — My boops, Share, help, Clear grid — lives in the
   * '⋯' menu". Rendering it in both places would give the app two Clear
   * buttons, not one styled differently.
   */
  showClearGrid?: boolean
}

/**
 * The transport bar. Loop is unconditional: the play/pause button is the
 * entire transport, no stop/restart/record. No swing control — never add
 * one. Clear-grid (ticket 15) sits behind the divider, dashed and coral so it
 * is never mistakable for "play from the top" (spec: "The grid" — clear-all).
 *
 * Tempo used to sit between the two: it is Speed in the song bar's header now,
 * at every width (screenspace ticket 02), so this bar no longer knows the bpm.
 */
export function Transport({
  isPlaying,
  onToggle,
  onClearAll,
  onNewBoop,
  showClearGrid = true,
}: TransportProps) {
  const [confirmingClear, setConfirmingClear] = useState(false)

  return (
    <div className={styles.bar} data-testid="transport-bar">
      <button
        type="button"
        className={styles.play}
        onClick={onToggle}
        aria-pressed={isPlaying}
        aria-label={isPlaying ? 'Pause' : 'Play'}
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
      {/* The bar's actions, pushed right as one group. On the phone that is
          New boop alone: Clear grid lives in the "⋯" menu, and the button
          stays the 44px "+" it shrank to for the tempo block. */}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.newBoop}
          onClick={onNewBoop}
          aria-label="New boop"
          data-testid="new-boop-button"
        >
          <span className={styles.newBoopLabel}>New boop</span>
          <span className={styles.newBoopGlyph} aria-hidden="true">
            +
          </span>
        </button>
        {showClearGrid && (
          <>
            <div className={styles.divider} aria-hidden="true" />
            <button
              type="button"
              className={styles.clear}
              onClick={() => setConfirmingClear(true)}
              data-testid="clear-grid-button"
            >
              Clear grid
            </button>
          </>
        )}
      </div>
      {confirmingClear && (
        <ConfirmCard
          {...CLEAR_GRID_CONFIRM}
          onSafe={() => setConfirmingClear(false)}
          onDestructive={() => {
            onClearAll()
            setConfirmingClear(false)
          }}
        />
      )}
    </div>
  )
}
