import { PresetThumbnail } from './PresetThumbnail.tsx'
import { PRESETS, type PresetId } from './presets.ts'
import styles from './PresetRow.module.scss'

interface PresetRowProps {
  activePreset: PresetId | null
  onSelectPreset: (presetId: PresetId) => void
}

/**
 * The onboarding: a fixed row of starter grooves with the blank canvas
 * presented as the first card (spec: "Onboarding & light education"; design
 * handoff: "Preset row"). Tapping a card loads it straight into the working
 * grid, ready to play — no confirmation, no wizard. "Now make it yours" stays
 * implicit; the copy never says it.
 */
export function PresetRow({ activePreset, onSelectPreset }: PresetRowProps) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>Starters</span>
      <div className={styles.cards}>
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={styles.card}
            data-active={activePreset === preset.id}
            onClick={() => onSelectPreset(preset.id)}
            data-testid={`preset-card-${preset.id}`}
          >
            <PresetThumbnail rows={preset.rows} />
            <span className={styles.name}>{preset.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
