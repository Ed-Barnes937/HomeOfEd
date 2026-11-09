import { accountUrl } from '../hubUrl.ts'
import styles from './SyncedChip.module.scss'

interface SyncedChipProps {
  /** The profile the boops are being kept for. */
  name: string
}

/**
 * The one piece of chrome the family account adds to boop (ADR 0080): who the
 * boops are being kept for, and a way to the hub's account page to change it.
 * Quiet, like the saved-state words beside it - never a status light, and
 * never anything a child has to answer.
 */
export function SyncedChip({ name }: SyncedChipProps) {
  return (
    <a
      className={styles.chip}
      href={accountUrl(window.location.hostname)}
      data-testid="synced-chip"
    >
      synced as {name}
    </a>
  )
}
