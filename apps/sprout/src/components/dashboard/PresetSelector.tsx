// Ported from the source (behaviour/markup). Tailwind classes retained; SCSS is P7.
import { PRESET_LIST, type PresetName } from '@hoe/sprout-shared'

interface PresetSelectorProps {
  value: PresetName
  onChange: (presetName: PresetName) => void
  disabled?: boolean
}

export function PresetSelector({ value, onChange, disabled }: PresetSelectorProps) {
  return (
    <div className="grid gap-2">
      {PRESET_LIST.map((preset) => {
        const isSelected = value === preset.name
        return (
          <button
            type="button"
            key={preset.name}
            onClick={() => onChange(preset.name)}
            disabled={disabled}
            aria-pressed={isSelected}
            className={`rounded-lg border p-3 text-left transition-colors ${
              isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <p className="font-medium">{preset.label}</p>
            <p className="text-muted-foreground text-sm">{preset.description}</p>
          </button>
        )
      })}
    </div>
  )
}
