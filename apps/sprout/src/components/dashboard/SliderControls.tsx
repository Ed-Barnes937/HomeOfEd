import { SLIDER_LABELS, type PresetSliders } from '@hoe/sprout-shared'

import { SLIDER_KEYS } from '../../server/domain/presets.ts'
import { Slider } from '../ui/slider.tsx'
import styles from './SliderControls.module.scss'

interface SliderControlsProps {
  values: PresetSliders
  onChange: (key: keyof PresetSliders, value: number) => void
  onCommit?: (key: keyof PresetSliders, value: number) => void
  disabled?: boolean
}

export function SliderControls({ values, onChange, onCommit, disabled }: SliderControlsProps) {
  return (
    <div className={styles.container}>
      {SLIDER_KEYS.map((key) => {
        const meta = SLIDER_LABELS[key]
        const value = values[key]
        const labelId = `slider-label-${key}`
        return (
          <div key={key} className={styles.group}>
            <div className={styles.header}>
              <label id={labelId} className={styles.label}>
                {meta.label}
              </label>
              <span className={styles.value}>{value} / 5</span>
            </div>
            <Slider
              min={1}
              max={5}
              step={1}
              value={[value]}
              disabled={disabled}
              aria-labelledby={labelId}
              onValueChange={(newValue) => onChange(key, newValue)}
              onValueCommitted={(newValue) => onCommit?.(key, newValue)}
            />
            <div className={styles.range}>
              <span>{meta.low}</span>
              <span>{meta.high}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
