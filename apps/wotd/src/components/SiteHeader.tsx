import { Link } from '@tanstack/react-router'

import { BookOpenIcon } from './icons.tsx'
import styles from './SiteHeader.module.scss'
import { Typography } from './Typography.tsx'

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.wordmark}>
        <Typography variant="h1" className={styles.title}>
          <BookOpenIcon size={32} />
          Word of the Day!
          <BookOpenIcon size={32} />
        </Typography>
      </Link>
    </header>
  )
}
