// Child-facing honest disclosure (ADR-0017): the statement card replaces the
// new-conversation empty state; the persistent line sits above the chat input
// on every chat screen. Copy (do not reword) lives in lib/disclosure.ts. The
// preset is null until the `children.myConfig` read resolves — meanwhile both
// surfaces fall back to the strictest register (ADR-0016 safe-by-default).
import type { PresetName } from '@hoe/sprout-shared'

import {
  DISCLOSURE_CARD_LINES,
  DISCLOSURE_CARD_TITLE,
  DISCLOSURE_LINE,
} from '../../lib/disclosure.ts'
import styles from './Disclosure.module.scss'

interface DisclosureProps {
  preset: PresetName | null
}

export function DisclosureCard({ preset }: DisclosureProps) {
  return (
    <div data-testid="disclosure-card" className={styles.card}>
      <span className={styles.cardEmoji} aria-hidden="true">
        🤖
      </span>
      <p className={styles.cardTitle}>{DISCLOSURE_CARD_TITLE}</p>
      {DISCLOSURE_CARD_LINES[preset ?? 'early-learner'].map((line) => (
        <p key={line} className={styles.cardLine}>
          {line}
        </p>
      ))}
    </div>
  )
}

export function DisclosureLine({ preset }: DisclosureProps) {
  return (
    <p data-testid="disclosure-line" className={styles.line}>
      {DISCLOSURE_LINE[preset ?? 'early-learner']}
    </p>
  )
}
