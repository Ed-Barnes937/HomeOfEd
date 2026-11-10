import styles from './ImportOfferCard.module.scss'

interface ImportOfferCardProps {
  /** The profile the boops would be kept for. */
  name: string
  onAccept: () => void
  onDecline: () => void
}

/**
 * The first-link offer (ADR 0080): the one time boop asks about the account,
 * the first time a device is playing as a given profile.
 *
 * It takes the confirm card's geometry but not its buttons: `ConfirmCard`'s
 * second choice is styled as the destructive one, and nothing here is
 * destructive - the boops stay on the device whichever answer a parent gives.
 */
export function ImportOfferCard({ name, onAccept, onDecline }: ImportOfferCardProps) {
  return (
    <div className={styles.overlay}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-offer-title"
        aria-describedby="import-offer-message"
        data-testid="import-offer"
      >
        <p id="import-offer-title" className={styles.title}>
          Keep these boops on {name}&rsquo;s account?
        </p>
        <p id="import-offer-message" className={styles.message}>
          They stay on this device either way.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.accept}
            onClick={onAccept}
            data-testid="import-offer-accept"
          >
            Yes, keep them
          </button>
          <button
            type="button"
            className={styles.decline}
            onClick={onDecline}
            data-testid="import-offer-decline"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
