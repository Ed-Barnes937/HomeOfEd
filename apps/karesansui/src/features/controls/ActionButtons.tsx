import styles from './ActionButtons.module.scss'

export interface ActionButtonsProps {
  /** Actively drawing (drives the rAF loop right now). */
  running: boolean
  /** A draw has started but is not currently running (paused, awaiting resume). */
  paused: boolean
  /** A clearing sweep is in flight — Play is inert until it finishes. */
  clearing: boolean
  onPlay: () => void
  onClear: () => void
  onSave: () => void
  onDownload: () => void
}

/** Play/Pause primary button + Clear / Save / Download secondaries (plan 0008 D5). */
export function ActionButtons({
  running,
  paused,
  clearing,
  onPlay,
  onClear,
  onSave,
  onDownload,
}: ActionButtonsProps) {
  const playLabel = running ? '❚❚  Pause' : paused ? '▸  Resume' : '▸  Play'
  const clearLabel = clearing ? 'Clearing…' : 'Clear'

  return (
    <>
      <button
        type="button"
        className={styles.run}
        data-testid="play"
        aria-label={playLabel}
        disabled={clearing}
        onClick={onPlay}
      >
        {playLabel}
      </button>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.secondary}
          data-testid="clear-button"
          aria-label={clearLabel}
          disabled={running || clearing}
          onClick={onClear}
        >
          {clearLabel}
        </button>
        <button
          type="button"
          className={styles.secondary}
          data-testid="save-button"
          aria-label="Save garden"
          onClick={onSave}
        >
          Save
        </button>
        <button
          type="button"
          className={styles.secondary}
          data-testid="download-button"
          aria-label="Download PNG"
          onClick={onDownload}
        >
          ↓ Download
        </button>
      </div>
    </>
  )
}
