import styles from './ActionButtons.module.scss'

export interface ActionButtonsProps {
  /** Actively carving (drives the rAF loop right now). */
  running: boolean
  /** A carve has started but is not currently running (paused, awaiting resume). */
  paused: boolean
  /** A smoothing sweep is in flight — Run is inert until it finishes. */
  smoothing: boolean
  onRun: () => void
  onSmooth: () => void
  onSave: () => void
  onExport: () => void
}

/** Run/Pause primary button + Smooth / Save / Export secondaries. */
export function ActionButtons({
  running,
  paused,
  smoothing,
  onRun,
  onSmooth,
  onSave,
  onExport,
}: ActionButtonsProps) {
  const runLabel = running ? '❚❚  Pause' : paused ? '▶  Resume raking' : '▶  Turn the crank'
  const smoothLabel = smoothing ? 'Smoothing…' : 'Smooth'

  return (
    <>
      <button
        type="button"
        className={styles.run}
        data-testid="run-button"
        aria-label={runLabel}
        disabled={smoothing}
        onClick={onRun}
      >
        {runLabel}
      </button>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.secondary}
          data-testid="smooth-button"
          aria-label={smoothLabel}
          disabled={running || smoothing}
          onClick={onSmooth}
        >
          {smoothLabel}
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
          data-testid="export-button"
          aria-label="Export PNG"
          onClick={onExport}
        >
          ↓ PNG
        </button>
      </div>
    </>
  )
}
