import styles from './ConfirmCard.module.scss'

interface ConfirmCardProps {
  title: string
  message: string
  /** Left, filled button — the non-destructive choice. */
  safeLabel: string
  /** Right, outlined button — the destructive choice. */
  destructiveLabel: string
  onSafe: () => void
  onDestructive: () => void
}

/**
 * The shared confirm-card shape from the design handoff (docs/reference/boop-design/README.md,
 * "Save, rename, delete, clear, share" — "Both confirms share one shape"):
 * clear-grid (this ticket) and delete-groove (ticket 20) both render this.
 * No keyboard-only destructive path — every button here is a real touch target.
 */
export function ConfirmCard({
  title,
  message,
  safeLabel,
  destructiveLabel,
  onSafe,
  onDestructive,
}: ConfirmCardProps) {
  return (
    <div className={styles.overlay}>
      <div
        className={styles.card}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-card-title"
        aria-describedby="confirm-card-message"
      >
        <p id="confirm-card-title" className={styles.title}>
          {title}
        </p>
        <p id="confirm-card-message" className={styles.message}>
          {message}
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.safe}
            onClick={onSafe}
            data-testid="confirm-safe-button"
          >
            {safeLabel}
          </button>
          <button
            type="button"
            className={styles.destructive}
            onClick={onDestructive}
            data-testid="confirm-destructive-button"
          >
            {destructiveLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
