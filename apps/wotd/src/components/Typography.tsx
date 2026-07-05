import type { ElementType, ReactNode } from 'react'

import styles from './Typography.module.scss'

type Variant = 'h1' | 'h2' | 'h3' | 'p'

const TAG: Record<Variant, ElementType> = { h1: 'h1', h2: 'h2', h3: 'h3', p: 'p' }

type TypographyProps = {
  variant?: Variant
  children: ReactNode
  className?: string
}

export function Typography({ variant = 'p', children, className }: TypographyProps) {
  const Tag = TAG[variant]
  const classes = className ? `${styles[variant]} ${className}` : styles[variant]
  return <Tag className={classes}>{children}</Tag>
}
