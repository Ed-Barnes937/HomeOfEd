// Minimal input primitive (plain <input>). Styling is P7 (plan §8).
import type { InputHTMLAttributes } from 'react'

import { cn } from '../../lib/utils.ts'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('input', className)} {...props} />
}
