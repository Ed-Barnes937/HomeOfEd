import styles from './PreviewToggle.module.scss'

export interface ClearingRakeToggleProps {
  checked: boolean
  onChange: () => void
}

/**
 * The "Clearing rake" pill switch — when on, the machine draws, sweeps the bed
 * smooth, and draws again forever (plan 0008 D4). Reuses the preview toggle's
 * pill styling.
 */
export function ClearingRakeToggle({ checked, onChange }: ClearingRakeToggleProps) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>Clearing rake</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="Clearing rake"
        data-testid="clearing-rake-toggle"
        className={styles.toggle}
        data-on={checked}
        onClick={onChange}
      >
        <span className={styles.knob} />
      </button>
    </div>
  )
}
