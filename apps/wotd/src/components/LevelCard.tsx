import { Link } from '@tanstack/react-router'
import type { ComponentType } from 'react'

import type { Difficulty } from '../server/wordGenerator.ts'
import { ArrowRightIcon, LightbulbIcon, RocketIcon, SparklesIcon, StarIcon, ZapIcon, type IconProps } from './icons.tsx'
import styles from './LevelCard.module.scss'
import { Typography } from './Typography.tsx'

const ICON: Record<Difficulty, ComponentType<IconProps>> = {
  beginner: LightbulbIcon,
  intermediate: StarIcon,
  advanced: ZapIcon,
  expert: RocketIcon,
}

/** Age-hint copy, per the school key-stage the level is aimed at. */
const KS_HINT: Record<Difficulty, string> = {
  beginner: 'Typically KS1',
  intermediate: 'Typically KS2',
  advanced: 'Typically KS3',
  expert: 'Typically KS4',
}

type LevelCardProps = { level: Difficulty }

export function LevelCard({ level }: LevelCardProps) {
  const Icon = ICON[level]
  return (
    <Link
      to="/wotd"
      search={{ level }}
      className={styles.card}
      data-level={level}
      data-testid={`level-card-${level}`}
    >
      <SparklesIcon size={20} className={styles.sparkleTopLeft} />
      <SparklesIcon size={20} className={styles.sparkleBottomRight} />
      <div className={styles.content}>
        <Icon size={40} />
        <Typography variant="h3">{level}</Typography>
        <Typography className={styles.hint}>{KS_HINT[level]}</Typography>
        <span className={styles.cta}>
          Select Level <ArrowRightIcon size={18} />
        </span>
      </div>
    </Link>
  )
}
