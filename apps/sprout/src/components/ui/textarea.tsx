// Minimal textarea primitive (plain <textarea>). Styling is P7 (plan §8).
import type { TextareaHTMLAttributes } from 'react'

import { cn } from '../../lib/utils.ts'

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('textarea', className)} {...props} />
}
