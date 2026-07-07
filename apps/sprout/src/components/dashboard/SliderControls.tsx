// Ported from the source (behaviour/markup). Tailwind classes retained; SCSS is P7.
import { SLIDER_LABELS, type PresetSliders } from '@hoe/sprout-shared'

import { SLIDER_KEYS } from '../../server/domain/presets.ts'
import { Slider } from '../ui/slider.tsx'

interface SliderControlsProps {
  values: PresetSliders
  onChange: (key: keyof PresetSliders, value: number) => void
  onCommit?: (key: keyof PresetSliders, value: number) => void
  disabled?: boolean
}

export function SliderControls({ values, onChange, onCommit, disabled }: SliderControlsProps) {
  return (
    <div className="flex flex-col gap-4">
      {SLIDER_KEYS.map((key) => {
        const meta = SLIDER_LABELS[key]
        const value = values[key]
        const labelId = `slider-label-${key}`
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label id={labelId} className="text-sm font-medium">
                {meta.label}
              </label>
              <span className="text-muted-foreground text-xs">{value} / 5</span>
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
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>{meta.low}</span>
              <span>{meta.high}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
