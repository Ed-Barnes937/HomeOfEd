// Minimal button primitive. The source used a shadcn/@base-ui button driven by
// `class-variance-authority`; that Tailwind→SCSS reimplementation is P7 (plan
// §8). For P4 this is a plain <button> that preserves the SAME import surface
// (`Button` + `buttonVariants`) the ported screens use, so behaviour/markup is
// in place and only the styling remains for P7. `buttonVariants` returns a
// stable className string (used on <Link>/<a> too) rather than real styles.
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../lib/utils.ts'

export type ButtonVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link'
export type ButtonSize = 'default' | 'xs' | 'sm' | 'lg' | 'icon'

export interface ButtonVariantOptions {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

/** Returns a className string. Styling is P7; this just tags variant/size. */
export function buttonVariants(opts: ButtonVariantOptions = {}): string {
  const { variant = 'default', size = 'default', className } = opts
  return cn('btn', `btn-${variant}`, `btn-${size}`, className)
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({ className, variant = 'default', size = 'default', ...props }: ButtonProps) {
  return <button className={buttonVariants({ variant, size, className })} {...props} />
}
