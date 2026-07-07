// Minimal slider primitive over a native range input. The source used an
// @base-ui slider; the styled reimplementation is P7 (plan §8). It keeps a
// single-value `value` array (the ported controls pass `[n]`), but emits a
// single number to `onValueChange` (live) / `onValueCommitted` (on release).
// `onInput` fires live, `onChange` fires on commit for a range input.
import { cn } from '../../lib/utils.ts'

export interface SliderProps {
  min?: number
  max?: number
  step?: number
  value: number[]
  disabled?: boolean
  className?: string
  'aria-labelledby'?: string
  'aria-label'?: string
  onValueChange?: (value: number) => void
  onValueCommitted?: (value: number) => void
}

export function Slider({
  min = 0,
  max = 100,
  step = 1,
  value,
  disabled,
  className,
  onValueChange,
  onValueCommitted,
  ...aria
}: SliderProps) {
  return (
    <input
      type="range"
      className={cn('slider', className)}
      min={min}
      max={max}
      step={step}
      value={value[0] ?? min}
      disabled={disabled}
      aria-labelledby={aria['aria-labelledby']}
      aria-label={aria['aria-label']}
      onInput={(e) => onValueChange?.(Number((e.target as HTMLInputElement).value))}
      onChange={(e) => onValueCommitted?.(Number(e.target.value))}
    />
  )
}
