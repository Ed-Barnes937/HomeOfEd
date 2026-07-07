import { PRESET_LIST, type PresetName } from '@hoe/sprout-shared'

import { cn } from '../../lib/utils.ts'
import styles from './PresetSelector.module.scss'

interface PresetSelectorProps {
  value: PresetName
  onChange: (presetName: PresetName) => void
  disabled?: boolean
}

export function PresetSelector({ value, onChange, disabled }: PresetSelectorProps) {
  return (
    <div className={styles.grid}>
      {PRESET_LIST.map((preset) => {
        const isSelected = value === preset.name
        return (
          <button
            type="button"
            key={preset.name}
            onClick={() => onChange(preset.name)}
            disabled={disabled}
            aria-pressed={isSelected}
            className={cn(
              styles.preset,
              isSelected && styles.presetSelected,
              disabled && styles.presetDisabled,
            )}
          >
            <p className={styles.label}>{preset.label}</p>
            <p className={styles.description}>{preset.description}</p>
          </button>
        )
      })}
    </div>
  )
}
