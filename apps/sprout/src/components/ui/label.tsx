// Label primitive (plain <label> + SCSS module, P7a). Same import surface as P4.
import type { LabelHTMLAttributes } from 'react'

import { cn } from '../../lib/utils.ts'
import styles from './label.module.scss'

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn(styles.label, className)} {...props} />
}
