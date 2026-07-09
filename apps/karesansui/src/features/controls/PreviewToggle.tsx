import styles from './PreviewToggle.module.scss'

export interface PreviewToggleProps {
  checked: boolean
  onChange: () => void
}

/** The "Preview line" pill switch — toggles the faint guide line under the sand. */
export function PreviewToggle({ checked, onChange }: PreviewToggleProps) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>Preview line</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="Preview line"
        data-testid="preview-toggle"
        className={styles.toggle}
        data-on={checked}
        onClick={onChange}
      >
        <span className={styles.knob} />
      </button>
    </div>
  )
}
