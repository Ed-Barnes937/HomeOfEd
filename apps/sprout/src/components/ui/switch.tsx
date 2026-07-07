// Switch primitive (P7a). Styled wrapper over @base-ui/react's accessible switch
// (role="switch", aria-checked, keyboard support). Keeps the exact P4 prop
// surface (checked / onCheckedChange(boolean) / disabled / aria-label) so the
// settings screen and its .iwft flow (getByRole('switch') + aria-checked) still
// pass and P7b stays mechanical.
import { Switch as SwitchPrimitive } from '@base-ui/react/switch'

import { cn } from '../../lib/utils.ts'
import styles from './switch.module.scss'

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export function Switch({ checked, onCheckedChange, disabled, className, ...aria }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(styles.root, className)}
      checked={checked}
      disabled={disabled}
      aria-label={aria['aria-label']}
      onCheckedChange={(next) => onCheckedChange(next)}
    >
      <SwitchPrimitive.Thumb className={styles.thumb} />
    </SwitchPrimitive.Root>
  )
}
