import type { ButtonHTMLAttributes } from 'react'

import styles from './Button.module.scss'

type Variant = 'default' | 'secondary' | 'ghost'
type Size = 'default' | 'lg'

const SIZE_CLASS: Record<Size, string> = { default: styles.sizeDefault ?? '', lg: styles.sizeLg ?? '' }

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
}

export function Button({ variant = 'default', size = 'default', className, ...props }: ButtonProps) {
  const classes = [styles.button, styles[variant], SIZE_CLASS[size], className].filter(Boolean).join(' ')
  return <button className={classes} {...props} />
}
