// Textarea primitive (plain <textarea> + SCSS module, P7a). Same import surface as P4.
import type { TextareaHTMLAttributes } from 'react'

import { cn } from '../../lib/utils.ts'
import styles from './textarea.module.scss'

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(styles.textarea, className)} {...props} />
}
