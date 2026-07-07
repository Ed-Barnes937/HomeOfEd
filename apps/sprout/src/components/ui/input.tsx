// Input primitive (plain <input> + SCSS module, P7a). Same import surface as P4.
import type { InputHTMLAttributes } from 'react'

import { cn } from '../../lib/utils.ts'
import styles from './input.module.scss'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(styles.input, className)} {...props} />
}
