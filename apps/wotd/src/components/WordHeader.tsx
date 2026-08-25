import { Link } from '@tanstack/react-router'

import { formatShortDate } from '../formatDate.ts'
import { DIFFICULTIES, type Difficulty } from '../server/wordGenerator.ts'
import { ArrowLeftIcon } from './icons.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'
import styles from './WordHeader.module.scss'

type WordHeaderProps = { level: Difficulty }

/**
 * The word screen's top bar (frames 5b/5e). Back link to the picker —
 * "Levels" on mobile, "All levels" on desktop — then the level pill (number
 * badge + name) pushed right, and the theme toggle. Desktop adds the date
 * between the back link and the pill.
 */
export function WordHeader({ level }: WordHeaderProps) {
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.back} data-testid="wotd-back">
        <ArrowLeftIcon size={15} strokeWidth={2.4} className={styles.backIcon} />
        <span className={styles.backMobile}>Levels</span>
        <span className={styles.backDesktop}>All levels</span>
      </Link>
      <div className={styles.right}>
        <span className={styles.date}>{formatShortDate(new Date())}</span>
        <span className={styles.pill} data-level={level} data-testid="level-pill">
          <span className={styles.pillBadge}>{DIFFICULTIES.indexOf(level) + 1}</span>
          {level}
        </span>
        <ThemeToggle />
      </div>
    </header>
  )
}
