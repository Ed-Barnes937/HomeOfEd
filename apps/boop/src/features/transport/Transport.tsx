import styles from './Transport.module.scss'

interface TransportProps {
  isPlaying: boolean
  onToggle: () => void
}

/**
 * The transport bar. Ticket 13 ships only the play/pause control — tempo and
 * clear-grid land in later tickets. Loop is unconditional: this button is the
 * entire transport, no stop/restart/record.
 */
export function Transport({ isPlaying, onToggle }: TransportProps) {
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
    </div>
  )
}
