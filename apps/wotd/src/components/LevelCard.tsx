import { Link } from '@tanstack/react-router'

import { DIFFICULTIES, type Difficulty } from '../server/wordGenerator.ts'
import { ArrowRightIcon } from './icons.tsx'
import styles from './LevelCard.module.scss'

/** Age-hint copy, per the school key-stage the level is aimed at. */
const KS_HINT: Record<Difficulty, string> = {
  beginner: 'Typically KS1',
  intermediate: 'Typically KS2',
  advanced: 'Typically KS3',
  expert: 'Typically KS4',
}

type LevelCardProps = { level: Difficulty }

/**
 * One level in the picker. Mobile: a horizontal tappable row (number badge,
 * name, key-stage hint, chevron). Desktop: a column card with a "START →"
 * affordance. Same element both sizes — CSS swaps the chevron for the START
 * row at the grid breakpoint.
 */
export function LevelCard({ level }: LevelCardProps) {
  return (
    <Link
      to="/wotd"
      search={{ level }}
      className={styles.card}
      data-level={level}
      data-testid={`level-card-${level}`}
    >
      <span className={styles.badge}>{DIFFICULTIES.indexOf(level) + 1}</span>
      <span className={styles.names}>
        <span className={styles.name}>{level}</span>
        <span className={styles.hint}>{KS_HINT[level]}</span>
      </span>
      <ArrowRightIcon size={18} strokeWidth={2.2} className={styles.chevron} />
      <span className={styles.start}>
        Start <ArrowRightIcon size={15} strokeWidth={2.4} />
      </span>
    </Link>
  )
}
