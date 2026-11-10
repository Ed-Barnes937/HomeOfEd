import { switchPlayerUrlFor } from '@hoe/accounts'

import styles from './SyncedChip.module.scss'

interface SyncedChipProps {
  /** The profile the boops are being kept for. */
  name: string
  /** The phone renders it as a menu entry; its 52px strip has no room for a chip. */
  className?: string
}

/**
 * The one piece of chrome the family account adds to boop (ADR 0080): who the
 * boops are being kept for, and a way to hub to switch player and come back
 * here. Quiet, like the saved-state words beside it - never a status light,
 * and never anything a child has to answer. Outside the estate there is no hub
 * to switch at, so it is words alone.
 */
export function SyncedChip({ name, className }: SyncedChipProps) {
  const href = switchPlayerUrlFor(window.location.href)
  const label = `synced as ${name}`
  return href === null ? (
    <span className={className ?? styles.chip} data-testid="synced-chip">
      {label}
    </span>
  ) : (
    <a className={className ?? styles.chip} href={href} data-testid="synced-chip">
      {label}
    </a>
  )
}
