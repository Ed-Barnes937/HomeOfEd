import type { CSSProperties } from 'react'

import { bpmToPercent, percentToBpm } from './tempoScale.ts'
import styles from './Transport.module.scss'

interface TransportProps {
  isPlaying: boolean
  onToggle: () => void
  bpm: number
  onTempoChange: (bpm: number) => void
}

/**
 * The transport bar. Ticket 16 adds the tempo slider — clear-grid lands in a
 * later ticket. Loop is unconditional: the play/pause button is the entire
 * transport, no stop/restart/record. No swing control — never add one.
 */
export function Transport({ isPlaying, onToggle, bpm, onTempoChange }: TransportProps) {
  const percent = bpmToPercent(bpm)

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
    </div>
  )
}
