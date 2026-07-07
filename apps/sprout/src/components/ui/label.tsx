// Minimal label primitive (plain <label>). Styling is P7 (plan §8).
import type { LabelHTMLAttributes } from 'react'

import { cn } from '../../lib/utils.ts'

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('label', className)} {...props} />
}
