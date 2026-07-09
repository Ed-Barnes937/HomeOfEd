import type { Preset } from '../garden/settings.ts'
import styles from './SavedGardens.module.scss'

export interface SavedGardensProps {
  presets: Preset[]
  onLoad: (preset: Preset) => void
  onDelete: (index: number) => void
}

/** Preset pills (name loads, × deletes) or the empty-state hint. */
export function SavedGardens({ presets, onLoad, onDelete }: SavedGardensProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.label}>Saved gardens</div>
      {presets.length > 0 ? (
        <div className={styles.pills}>
          {presets.map((preset, i) => (
            <span key={`${preset.name}-${i}`} className={styles.pill} data-testid={`preset-${i}`}>
              <button type="button" className={styles.name} onClick={() => onLoad(preset)}>
                {preset.name}
              </button>
              <button
                type="button"
                className={styles.remove}
                aria-label={`Delete preset ${preset.name}`}
                data-testid={`preset-delete-${i}`}
                onClick={() => onDelete(i)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>Tap Save to keep a gear + rake setup here.</div>
      )}
    </div>
  )
}
