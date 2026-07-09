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

/**
 * The strip's actions (ADR 0021): one amber `▸ Play` — the only accent in the
 * console — followed by dimmer `Clear · Save · ↓` text links. No button boxes.
 */
export function ActionButtons({
  running,
  paused,
  clearing,
  onPlay,
  onClear,
  onSave,
  onDownload,
}: ActionButtonsProps) {
  const playWord = running ? 'Pause' : paused ? 'Resume' : 'Play'
  const playGlyph = running ? '❚❚' : '▸'
  const clearLabel = clearing ? 'Clearing…' : 'Clear'

  return (
    <>
      <button
        type="button"
        className={styles.play}
        data-testid="play"
        aria-label={playWord}
        disabled={clearing}
        onClick={onPlay}
      >
        <span className={styles.glyph} aria-hidden="true">
          {playGlyph}
        </span>
        {playWord}
      </button>

      <span className={styles.sep} aria-hidden="true" />

      <div className={styles.links}>
        <button
          type="button"
          className={styles.link}
          data-testid="clear-button"
          aria-label={clearLabel}
          disabled={running || clearing}
          onClick={onClear}
        >
          {clearLabel}
        </button>
        <span className={styles.dot} aria-hidden="true">
          ·
        </span>
        <button
          type="button"
          className={styles.link}
          data-testid="save-button"
          aria-label="Save garden"
          onClick={onSave}
        >
          Save
        </button>
        <span className={styles.dot} aria-hidden="true">
          ·
        </span>
        <button
          type="button"
          className={styles.link}
          data-testid="download-button"
          aria-label="Download PNG"
          onClick={onDownload}
        >
          ↓
        </button>
      </div>
    </>
  )
}
