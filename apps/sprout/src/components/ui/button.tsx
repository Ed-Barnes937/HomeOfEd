// Button primitive. SCSS-module reimplementation of the source's shadcn/cva
// button (P7a). Keeps the exact P4 import surface — `Button` + `buttonVariants`
// (used on <Link>/<a> too) and the `ButtonVariant`/`ButtonSize` types — so P7b's
// feature-component conversion stays mechanical. Plain <button>; no cva/@base-ui.
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../lib/utils.ts'
import styles from './button.module.scss'

export type ButtonVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link'
export type ButtonSize = 'default' | 'xs' | 'sm' | 'lg' | 'icon'

export interface ButtonVariantOptions {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

const SIZE_CLASS: Record<ButtonSize, string | undefined> = {
  default: styles.sizeDefault,
  xs: styles.sizeXs,
  sm: styles.sizeSm,
  lg: styles.sizeLg,
  icon: styles.sizeIcon,
}

/** Composes the button's SCSS-module classes into a single className string. */
export function buttonVariants(opts: ButtonVariantOptions = {}): string {
  const { variant = 'default', size = 'default', className } = opts
  return cn(styles.btn, styles[variant], SIZE_CLASS[size], className)
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({ className, variant = 'default', size = 'default', ...props }: ButtonProps) {
  return <button className={buttonVariants({ variant, size, className })} {...props} />
}
