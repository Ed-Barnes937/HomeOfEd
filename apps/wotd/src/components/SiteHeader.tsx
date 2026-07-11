import { Link } from '@tanstack/react-router'

import { hubUrl } from '../hubUrl.ts'
import { BookOpenIcon } from './icons.tsx'
import styles from './SiteHeader.module.scss'
import { Typography } from './Typography.tsx'

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <a
        className={styles.back}
        href={hubUrl(window.location.hostname)}
        aria-label="Back to home of ed"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        </svg>
      </a>
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
