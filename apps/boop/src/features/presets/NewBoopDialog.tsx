import { PresetThumbnail } from './PresetThumbnail.tsx'
import { PRESETS, type PresetId } from './presets.ts'
import styles from './NewBoopDialog.module.scss'

interface NewBoopDialogProps {
  activePreset: PresetId | null
  onSelectPreset: (presetId: PresetId) => void
  onClose: () => void
}

/**
 * "New boop" (ticket 36): the four starters, which used to live in a row on
 * the main screen. Picking one loads it and closes — no confirmation, no
 * wizard, and no warning that the grid is about to change, because picking a
 * starter is a creative act and the working grid it replaces was autosaved,
 * not lost. "Clear grid" is the destructive-feeling one.
 *
 * The card ring showing which starter is loaded is internal to this dialog:
 * the main screen never names a starter (ticket 31).
 *
 * Shell is "My boops"'s (design handoff §4) — the same paper card on the same
 * dim, so the app has one dialog shape. The cards keep §1's geometry (168px,
 * 12px padding, radius 14px, the dot matrix) and take §4's paper palette,
 * since §1's white-on-dark alphas would be invisible on paper.
 */
export function NewBoopDialog({ activePreset, onSelectPreset, onClose }: NewBoopDialogProps) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label="New boop"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <span className={styles.title}>New boop</span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close New boop"
            data-testid="new-boop-close-button"
          >
            ×
          </button>
        </div>

        <div className={styles.cards} data-testid="starter-cards">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={styles.starter}
              data-active={activePreset === preset.id}
              onClick={() => onSelectPreset(preset.id)}
              data-testid={`preset-card-${preset.id}`}
            >
              <PresetThumbnail rows={preset.rows} tone="paper" />
              <span className={styles.name}>{preset.name}</span>
            </button>
          ))}
        </div>

        <p className={styles.footer}>Tap one to start. Blank gives you an empty grid.</p>
      </div>
    </div>
  )
}
