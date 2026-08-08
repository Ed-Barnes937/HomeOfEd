import { useState, type CSSProperties } from 'react'

import { CLEAR_GRID_CONFIRM } from '../confirm/clearGridConfirm.ts'
import { ConfirmCard } from '../confirm/ConfirmCard.tsx'
import { bpmToPercent, percentToBpm } from './tempoScale.ts'
import styles from './Transport.module.scss'

interface TransportProps {
  isPlaying: boolean
  onToggle: () => void
  bpm: number
  onTempoChange: (bpm: number) => void
  onClearAll: () => void
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
 */
export function Transport({
  isPlaying,
  onToggle,
  bpm,
  onTempoChange,
  onClearAll,
  showClearGrid = true,
}: TransportProps) {
  const percent = bpmToPercent(bpm)
  const [confirmingClear, setConfirmingClear] = useState(false)

  return (
    <div className={styles.bar}>
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
      <div className={styles.tempo}>
        <div className={styles.tempoHeader}>
          <span className={styles.tempoLabel} id="tempo-label">
            Tempo
          </span>
          <span className={styles.tempoReadout} data-testid="tempo-readout">
            {bpm} BPM
          </span>
        </div>
        <div className={styles.tempoTrackRow}>
          <span className={styles.tempoEndpoint}>Slow</span>
          <input
            type="range"
            className={styles.tempoSlider}
            style={{ '--tempo-percent': `${percent}%` } as CSSProperties}
            min={0}
            max={100}
            step="any"
            value={percent}
            onChange={(event) => onTempoChange(percentToBpm(Number(event.target.value)))}
            aria-labelledby="tempo-label"
            aria-valuetext={`${bpm} BPM`}
            data-testid="tempo-slider"
          />
          <span className={styles.tempoEndpoint}>Fast</span>
        </div>
      </div>
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
