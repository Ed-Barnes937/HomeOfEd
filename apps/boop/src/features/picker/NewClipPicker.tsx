import { PatternThumbnail } from './PatternThumbnail.tsx'
import { BLANK_ROWS, SAMPLE_CLIPS, type SampleClip } from './sampleClips.ts'
import styles from './NewClipPicker.module.scss'

interface NewClipPickerProps {
  /** `null` is the Blank card. */
  onPick: (sample: SampleClip | null) => void
  onClose: () => void
}

/**
 * The "+ New clip" picker (ticket 17, spec §6): the paper-card dialog shell
 * the retired New boop dialog used, holding starter-style cards — Blank
 * first, then the eight sample clips. No per-card preview; picking is how
 * you hear one. Picking lands the choice as a new clip and closes; closing
 * without picking changes nothing.
 *
 * Focus/dismiss follows the app's existing dialog behaviour (spec §14):
 * the × button and a tap on the dimmed backdrop both close it.
 */
export function NewClipPicker({ onPick, onClose }: NewClipPickerProps) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label="New clip"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <span className={styles.title}>New clip</span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close New clip"
            data-testid="new-clip-close-button"
          >
            ×
          </button>
        </div>

        <div className={styles.cards} data-testid="picker-cards">
          <button
            type="button"
            className={styles.pickerCard}
            onClick={() => onPick(null)}
            data-testid="picker-card-blank"
          >
            <PatternThumbnail rows={BLANK_ROWS} />
            <span className={styles.name}>Blank</span>
          </button>
          {SAMPLE_CLIPS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              className={styles.pickerCard}
              onClick={() => onPick(sample)}
              data-testid={`picker-card-${sample.id}`}
            >
              <PatternThumbnail rows={sample.rows} />
              <span className={styles.name}>{sample.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
