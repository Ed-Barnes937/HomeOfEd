// Minimal switch primitive (an ARIA switch button). The source used an @base-ui
// switch; the styled reimplementation is P7 (plan §8). Same prop surface the
// ported settings screen uses.
import { cn } from '../../lib/utils.ts'

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export function Switch({ checked, onCheckedChange, disabled, className, ...aria }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={aria['aria-label']}
      disabled={disabled}
      className={cn('switch', className)}
      data-state={checked ? 'checked' : 'unchecked'}
      onClick={() => onCheckedChange(!checked)}
    />
  )
}
