// Slider primitive (P7a). Styled wrapper over @base-ui/react's accessible slider
// for keyboard/ARIA behaviour, keeping the exact P4 prop surface: single-value
// `value` array in, a single number out via `onValueChange` (live) /
// `onValueCommitted` (on release). API unchanged so P7b stays mechanical.
import { Slider as SliderPrimitive } from '@base-ui/react/slider'

import { cn } from '../../lib/utils.ts'
import styles from './slider.module.scss'

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
    <SliderPrimitive.Root
      className={cn(styles.root, className)}
      min={min}
      max={max}
      step={step}
      value={value[0] ?? min}
      disabled={disabled}
      thumbAlignment="edge"
      aria-labelledby={aria['aria-labelledby']}
      aria-label={aria['aria-label']}
      onValueChange={(next) => onValueChange?.(next)}
      onValueCommitted={(next) => onValueCommitted?.(next)}
    >
      <SliderPrimitive.Control className={styles.control}>
        <SliderPrimitive.Track className={styles.track}>
          <SliderPrimitive.Indicator className={styles.indicator} />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className={styles.thumb} />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}
